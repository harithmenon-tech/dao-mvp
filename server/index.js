// ═══════════════════════════════════════════════════════════════
// Decision Accountability OS — Production Server
// Serves the built frontend + proxies Claude API calls
// Run: npm start  (builds frontend then starts this server)
// ═══════════════════════════════════════════════════════════════
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "50mb" }));

// Serve built frontend
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "put_your_real_key_here" || key.trim() === "") return null;
  return key.trim();
}

// Health check — frontend calls this to know if API is ready
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiConfigured: !!getApiKey() });
});

// Claude API proxy with streaming support
app.post("/api/claude", async (req, res) => {
  const KEY = getApiKey();
  if (!KEY) {
    return res.status(500).json({
      error: "API key not configured. Add your ANTHROPIC_API_KEY to the .env file and restart the server."
    });
  }

  const { systemPrompt, messages, stream } = req.body || {};

  // Validate input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt || "",
        messages,
        stream: !!stream
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiResponse.status === 429) {
      return res.status(429).json({ error: "rate_limited", message: "Too many requests — please wait a moment and try again." });
    }
    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`Anthropic API ${apiResponse.status}:`, errText.slice(0, 500));
      return res.status(apiResponse.status).json({ error: errText });
    }

    // ─── Non-streaming ───
    if (!stream) {
      const data = await apiResponse.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      return res.json({ text });
    }

    // ─── Streaming: Anthropic SSE → newline-delimited JSON ───
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              res.write(JSON.stringify({ text: parsed.delta.text }) + "\n");
            }
            // Handle error events from the API
            if (parsed.type === "error") {
              res.write(JSON.stringify({ error: parsed.error?.message || "Stream error" }) + "\n");
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      console.error("Stream read error:", streamErr.message);
      // Try to send error through the stream
      try {
        res.write(JSON.stringify({ error: streamErr.message }) + "\n");
      } catch {}
    } finally {
      res.end();
    }
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === "AbortError"
      ? "Request timed out (120s). Try a shorter question."
      : err.message || "Internal server error";
    console.error("Server error:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      try { res.end(); } catch {}
    }
  }
});

app.post('/api/copilot', async (req, res) => {
  try {
    const { situation, risks, opportunities } = req.body;
    if (!situation) {
      return res.status(400).json({ error: 'situation field is required' });
    }
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `You are an executive decision advisor.
Given the following executive brief:
Situation: ${situation}
Top Risks: ${(risks || []).join('; ')}
Top Opportunities: ${(opportunities || []).join('; ')}
Generate exactly 3 strategic options for this executive to consider.
For each option provide:
- title: a concise label (maximum 8 words)
- description: exactly 2 sentences explaining what this option involves
- tradeoff: exactly 1 sentence on the main risk, cost, or constraint
Then provide:
- recommendation: 2 sentences identifying which option best balances the opportunity and risk
- confidence: one of exactly these three values: High, Medium, or Low
Respond in valid JSON only. No preamble, no markdown fences.
Schema: { options: [{title,description,tradeoff}], recommendation: string, confidence: string }`;
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = message.content[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[/api/copilot error]', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/variance', async (req, res) => {
  try {
    const { decisionTitle, context, rationale, tier, reviewNotes, uploadedDataSummary, activeDomain } = req.body;

    // Token cap: truncate uploadedDataSummary if > 800 chars
    const dataSummary = (uploadedDataSummary || '').length > 800
      ? (uploadedDataSummary || '').slice(0, 800)
      : (uploadedDataSummary || '');

    // Domain overlay injection
    let domainPrefix = '';
    if (activeDomain && activeDomain !== 'generic') {
      domainPrefix = `Domain context: This organisation operates in the ${activeDomain} sector. Apply domain-appropriate expertise when assessing whether this decision produced Better, Same, or Worse results.\n`;
    }

    const userPrompt = `${domainPrefix}Title:${decisionTitle || ''}|Tier:${tier || ''}|Context:${context || ''}|Rationale:${rationale || ''}|Review notes:${reviewNotes || ''}|Operational data:${dataSummary}\nReturn:{"variance":"Better"|"Same"|"Worse","confidence":"High"|"Medium"|"Low","reasoning":"Sentence one. Sentence two.","dataPoints":["point1"]}`;

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: 'You are a decision intelligence analyst. Assess whether this decision produced Better, Same, or Worse results than intended. Return ONLY valid JSON. No preamble, no markdown, no backticks.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[/api/variance error]', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/decision-health', async (req, res) => {
  try {
    const { decisions, dataSummary, activeDomain } = req.body;

    // Filter: only assess Draft or Confirmed decisions
    const filtered = (decisions || []).filter(
      d => d.status !== 'Reviewed' && d.status !== 'Archived'
    );

    // If nothing to assess, return early without calling Claude
    if (filtered.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // Token management: summarise if payload too large
    let decisionsPayload = filtered;
    if (JSON.stringify(decisionsPayload).length > 2000) {
      decisionsPayload = filtered.map(d => ({
        id: d.id,
        title: d.title,
        context: (d.context || '').slice(0, 200),
      }));
    }
    const decisionsJSON = JSON.stringify(decisionsPayload);

    // Domain overlay injection
    let domainOverlay = '';
    if (activeDomain && activeDomain !== 'generic') {
      domainOverlay = `Domain context: This organisation operates in the ${activeDomain} sector. Apply domain-appropriate expertise when assessing whether these decisions are on track.\n`;
    }

    const userPrompt = `${domainOverlay}Decisions:${decisionsJSON}|Data:${dataSummary || ''}\nReturn:{"results":[{"id":"id1","status":"Healthy","reasoning":"One sentence.","urgency":"Low"}]}`;

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a decision health analyst. Healthy=on track or completed well. Watch=early signs of underperformance. At Risk=contradicted by operational data. Return ONLY valid JSON. No preamble, no markdown, no backticks.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[/api/decision-health error]', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/situation', async (req, res) => {
  try {
    const { findings, scanType, domainContext } = req.body;
    if (!findings || findings.length === 0) {
      return res.status(400).json({ error: 'No findings provided' });
    }
    const findingSummary = findings.slice(0, 10).map((f, i) =>
      `${i + 1}. [${f.severity || 'MEDIUM'}] ${f.title || f.finding || JSON.stringify(f)}`
    ).join('\n');
    const domainNote = domainContext
      ? `\nDomain context: ${domainContext}`
      : '';
    const prompt = `You are a Chief Operating Officer advisor.
Based on these ${scanType || 'operational'} scan findings, provide a situational assessment.${domainNote}
FINDINGS:
${findingSummary}
Respond in this exact JSON format with no preamble or markdown:
{
  "situationSummary": "2-3 sentence overall situation assessment",
  "urgencyLevel": "HIGH|MEDIUM|LOW",
  "priorities": [
    {
      "rank": 1,
      "title": "priority title",
      "severity": "HIGH|MEDIUM|LOW",
      "insight": "one sentence insight",
      "action": "one sentence recommended action",
      "timeframe": "immediate|this week|this month"
    }
  ],
  "chiefQuestion": "The single most important question the CEO should be asking right now"
}
Provide exactly 3 priorities. Return only valid JSON.`;
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: 'You are a strategic business advisor. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.content[0].text.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const assessment = JSON.parse(clean);
    res.json({ success: true, assessment });
  } catch (err) {
    console.error('/api/situation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-brief', async (req, res) => {
  try {
    const { findings, scanType, domainContext, uploadedSummary } = req.body;
    if (!findings || findings.length === 0) {
      return res.status(400).json({ error: 'No findings provided' });
    }
    const findingSummary = findings.slice(0, 12).map((f, i) =>
      `${i + 1}. [${f.severity || 'MEDIUM'}] ${f.title || f.finding || JSON.stringify(f)}`
    ).join('\n');
    const domainNote = domainContext
      ? `\nOrganisation context: ${domainContext}` : '';
    const dataNote = uploadedSummary
      ? `\nData context: ${uploadedSummary}` : '';
    const prompt = `You are preparing an Executive Brief for the CEO.
Scan type: ${scanType || 'operational'}${domainNote}${dataNote}
FINDINGS:
${findingSummary}
Generate a concise executive brief in this exact JSON format with no preamble or markdown:
{
  "headline": "One sentence executive headline",
  "executiveSummary": "2-3 paragraph executive summary",
  "keyFindings": [
    { "title": "finding title", "detail": "one sentence detail", "severity": "HIGH|MEDIUM|LOW" }
  ],
  "strategicImplications": "2-3 sentences on strategic implications",
  "recommendedActions": [
    { "action": "action description", "owner": "CEO|COO|CFO|CTO", "timeframe": "immediate|this week|this month" }
  ],
  "generatedAt": "${new Date().toISOString()}"
}
Provide exactly 3 keyFindings and 3 recommendedActions. Return only valid JSON.`;
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: 'You are a strategic executive advisor. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.content[0].text.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const brief = JSON.parse(clean);
    res.json({ success: true, brief });
  } catch (err) {
    console.error('/api/generate-brief error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/risk-radar', async (req, res) => {
  try {
    const { decisions, domainContext } = req.body;
    const decisionList = (decisions || []).map(d =>
      `- ID: ${d.id || ''} | Statement: ${(d.statement || '').slice(0, 80)} | Tier: ${d.tier || ''} | Status: ${d.lifecycleStatus || ''} | Confidence: ${d.confidenceScore ?? ''} | Review Date: ${d.review_date || ''} | Tags: ${(d.tags || []).join(', ')}`
    ).join('\n');
    const domainNote = domainContext ? `\nDomain context: ${domainContext}` : '';
    const prompt = `You are a decision risk analyst.${domainNote}

Review the following decisions and identify risk signals:
${decisionList}

Identify risks for:
1. Overdue Reviews: review_date is in the past and lifecycleStatus is not "Closed"
2. Low Confidence on High-Tier: tier is "1" or "2" and confidenceScore <= 2
3. Missing Evidence: tier is "1" or "2" and the decision has no evidence field
4. Stale Status: lifecycleStatus is "Draft" or "Monitoring" for decisions (assume stale if status is Draft or Monitoring)

Return a JSON array of risk objects with this exact schema:
[
  {
    "decisionId": "string",
    "statement": "string (truncated to 60 chars)",
    "riskType": "Overdue Review" | "Low Confidence" | "Missing Evidence" | "Stale Status",
    "severity": "High" | "Medium" | "Low",
    "reason": "string (one sentence)"
  }
]

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: 'You are a decision risk analyst. Respond only with a valid JSON array, no markdown, no preamble.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const risks = JSON.parse(clean);
    return res.status(200).json({ risks });
  } catch (err) {
    console.error('[/api/risk-radar error]', err.message);
    return res.status(200).json({ risks: [], error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/scan — Deterministic enterprise & revenue scan
// Accepts: { dataSummary, scanType, domain }
// Returns: { text: string } — JSON string produced by Claude at temperature 0
// ─────────────────────────────────────────────────────────────────────────────
const SCAN_PROMPT_SERVER = (domain, currency) => `You are the Decision Accountability OS, built by 30GENS. You are a world-class decision intelligence engine.
${domain ? `Active domain: ${domain}` : ''}${domain === 'water' ? `

WATER UTILITIES — UK REGULATORY THRESHOLDS (DWI / WHO):
The following limits are legally binding under UK Drinking Water Inspectorate standards.
Flag ANY reading that breaches these thresholds as a Tier 1 finding:
- Aluminium (Al): maximum 0.200 mg/L. Any sample exceeding this limit is a regulatory breach.
- Turbidity (treated water): maximum 1.0 NTU at point of treatment. Operational trigger at 4.0 NTU.
- E. coli: maximum 0 CFU/100mL. Any detection — even a single count — is an immediate regulatory breach.

When scanning water utility data:
1. Check every Al, turbidity, and E. coli reading against these thresholds.
2. If any reading breaches a threshold, it MUST be reported as a finding.
3. State the exact breaching value, the threshold it breached, and the number of samples affected.
4. Do not generalise. Cite the specific data point from the uploaded file.` : ''}

You are running an Enterprise Scan. Your output must be fully deterministic — identical input must produce identical output.

STRICT OUTPUT RULES — these override everything else:
- Return UP TO 3 findings. Never return more than 3.
- Do NOT fabricate findings to meet a count. Only return findings supported by the data.
- A finding must meet defined thresholds. Do not infer unsupported patterns.
- Rank findings by severity first (Tier 1 before Tier 2 before Tier 3), then by financial impact descending. This order is mandatory.
- Every field is required. Use "Not identified" for any field where data is insufficient. Never omit a field.
- evidence: maximum 2 sentences. You MUST name the source file using the exact filename from the DATA SOURCE header, and cite the specific row value, date, or calculated figure that supports this finding. Format: "[Source: filename] specific value, date, or calculation". No generalisations. No unattributed assertions.
- impact: ${currency ? `quantify as a ${currency} amount or range (e.g. ${currency} 12,000 or ${currency} 8,000–15,000)` : 'quantify as an amount or range using the currency in the data (e.g. 12,000 or 8,000–15,000)'}. If not quantifiable, state "Non-financial: [one sentence]".
- fix: one imperative sentence only. Start with a verb.
- severity: must be exactly "Tier 1", "Tier 2", or "Tier 3". No other values accepted.
- confidence: must be exactly "HIGH", "MODERATE", or "LOW". No other values accepted.
- rootCause: must be exactly one of: "process", "people", "system", "governance". No other values accepted.

Scan for findings in this priority order — stop at 3:
1. CASH TRAPS: Financial items pending beyond threshold (>30 days)
2. PROCESS LEAKS: Rework, exceptions, manual workarounds, duplicates (>3 times in 90 days)
3. CAPACITY MISMATCHES: Overloaded or idle resources (>95% or <60% utilisation)
4. RECURRING FAILURES: Same incident type repeating (>3 times in 90 days)
5. DECISION STALLS: Decisions revisited without resolution (>3 discussions, no action)

If a finding spans multiple datasets, present it as one finding with combined evidence. Do not duplicate it across categories.

CROSS-FILE BILLING–TARIFF RULE:
If the uploaded data includes a source classified as [CLASSIFIED: BILLING] and a source classified as [CLASSIFIED: TARIFF], you MUST perform the following check as a mandatory scan step:
- Identify the tariff rate(s) effective in each billing period from the TARIFF source.
- Compare the amounts billed in the BILLING source against those effective rates for the same period.
- If billed amounts do not match the applicable tariff rate for any period, this constitutes a finding.
- Report such divergence as a standalone finding with: the period affected, the expected amount (derived from tariff × volume if volume data is present, or the stated tariff rate), the actual billed amount, and the variance.
- If data is insufficient to calculate the variance precisely, state the gap qualitatively and flag confidence as LOW.
This check is additive — it does not replace the standard 5-category scan. If the cross-file check produces a finding, include it within the 3-finding cap ranked by severity.

Return ONLY a valid JSON object. No markdown, no preamble, no explanation, no trailing text.
The JSON must use exactly this structure: {"findings":[{"number":1,"title":"","evidence":"","recurrence":"","impact":"","rootCause":"","fix":"","severity":"Tier 1","confidence":"HIGH","assumptions":""}]}`;

const REVENUE_SCAN_PROMPT_SERVER = (domain, currency) => `You are the Decision Accountability OS, built by 30GENS. You are a world-class decision intelligence engine.
${domain ? `Active domain: ${domain}` : ''}${domain === 'water' ? `

WATER UTILITIES — UK REGULATORY THRESHOLDS (DWI / WHO):
Compliance data against these thresholds represents a high-value data asset:
- Aluminium (Al): maximum 0.200 mg/L
- Turbidity (treated water): maximum 1.0 NTU at point of treatment. Operational trigger at 4.0 NTU.
- E. coli: maximum 0 CFU/100mL. Any detection is a regulatory breach.

When scanning for revenue opportunities in water utility data, consider:
1. Longitudinal compliance records against these thresholds are a monetisable data asset.
2. Breach patterns may indicate service gaps addressable through process improvements.
3. Regulatory reporting obligations create whitelabel potential for compliance tooling.` : ''}

You are running a Revenue Intelligence Scan. Your output must be fully deterministic — identical input must produce identical output.

STRICT OUTPUT RULES — these override everything else:
- Return UP TO 3 opportunities. Never return more than 3.
- Do NOT fabricate opportunities to meet a count. Only return opportunities supported by the data.
- A finding must meet defined thresholds. Do not infer unsupported patterns.
- Rank opportunities by revenuePotential descending — highest estimated value first. This order is mandatory.
- Every field is required. Use "Not identified" for any field where data is insufficient. Never omit a field.
- pattern: one sentence only. Start with a noun.
- evidence: maximum 2 sentences. You MUST name the source file using the exact filename from the DATA SOURCE header, and cite the specific row value, date, or calculated figure that supports this opportunity. Format: "[Source: filename] specific value, date, or calculation". No generalisations. No unattributed assertions.
- revenuePotential: ${currency ? `state as a ${currency} range (e.g. ${currency} 50,000–120,000 per year)` : 'state as a range using the currency in the data (e.g. 50,000–120,000 per year)'}. Include one-line basis for the estimate in parentheses.
- timeframe: must be exactly "Quick Win (0–90 days)", "Medium Term (90–180 days)", or "Long Term (180+ days)". No other values accepted.
- action: one imperative sentence only. Start with a verb.
- confidence: must be exactly "HIGH", "MODERATE", or "LOW". No other values accepted.
- category: must be exactly one of: "Data Assets", "Relationship Value", "Service Gaps", "Whitelabel Potential", "Pricing Leakage". No other values accepted.

Scan for opportunities in this priority order — stop at 3:
1. DATA ASSETS: Unique data this organisation owns that others would pay for
2. RELATIONSHIP VALUE: Under-monetised customer, partner, or ecosystem relationships
3. SERVICE GAPS: Places where customers pay for workarounds you could solve
4. WHITELABEL POTENTIAL: Internal processes or tools packageable for resale
5. PRICING LEAKAGE: Value delivered but not charged for

CROSS-FILE BILLING–TARIFF RULE:
If the uploaded data includes a source classified as [CLASSIFIED: BILLING] and a source classified as [CLASSIFIED: TARIFF], you MUST perform the following check as a mandatory scan step:
- Identify the tariff rate(s) effective in each billing period from the TARIFF source.
- Compare the amounts billed in the BILLING source against those effective rates for the same period.
- If billed amounts do not match the applicable tariff rate for any period, this constitutes a revenue opportunity (either under-collection or over-collection requiring correction).
- Report such divergence as a standalone opportunity under category "Pricing Leakage" with: the period affected, the expected amount (derived from tariff × volume if volume data is present, or the stated tariff rate), the actual billed amount, and the variance.
- If data is insufficient to calculate the variance precisely, state the gap qualitatively and flag confidence as LOW.
This check is additive — it does not replace the standard 5-category scan. If the cross-file check produces an opportunity, include it within the 3-opportunity cap ranked by revenuePotential.

Return ONLY a valid JSON object. No markdown, no preamble, no explanation, no trailing text.
The JSON must use exactly this structure: {"opportunities":[{"number":1,"category":"","pattern":"","evidence":"","revenuePotential":"","timeframe":"","action":"","confidence":"HIGH","assumptions":""}]}`;

function detectCurrency(summary) {
  if (!summary || typeof summary !== 'string') return null;
  const FINANCIAL_WORDS =
    /amount|cost|revenue|total|value|price|spend|income|billing|tariff|fee|charge/i;
  const CODE_RE = /\b(GBP|USD|EUR|AUD|SGD|AED|MYR)\b/g;
  // Extract column header lines only
  const headerLines = summary
    .split('\n')
    .filter(l => /Columns:/i.test(l));
  const headerText = headerLines.join(' ');
  // Hierarchy 1: currency code in header with financial word
  // within 40 chars. Digits alone are not sufficient.
  const codeMatches = [...headerText.matchAll(CODE_RE)];
  for (const m of codeMatches) {
    const window = headerText.slice(
      Math.max(0, m.index - 40),
      m.index + m[0].length + 40
    );
    if (FINANCIAL_WORDS.test(window)) {
      return m[1] === 'GBP' ? '£' : m[1] === 'EUR' ? '€' : m[1];
    }
  }
  // Hierarchy 2: £ or € in header adjacent to a word character.
  // $ excluded — too collision-prone in data files.
  const symbolMatches = [...headerText.matchAll(/[£€]/g)];
  for (const m of symbolMatches) {
    const after = headerText.slice(m.index + 1, m.index + 10);
    if (/\w/.test(after)) {
      return m[0];
    }
  }
  // Hierarchy 3: currency token in sample values immediately
  // adjacent to digits. Covers "£5420", "GBP 5420", "5,420 GBP".
  const patterns = [
    { re: /:\s*"[£€]\s*[\d,]+/,
      map: s => s.includes('£') ? '£' : '€' },
    { re: /:\s*"\s*(GBP|USD|EUR|AUD|SGD|AED|MYR)\s*[\d,]+/,
      map: (s, m) => m[1] === 'GBP' ? '£' : m[1] === 'EUR' ? '€' : m[1] },
    { re: /:\s*"[\d,\s]+(GBP|USD|EUR|AUD|SGD|AED|MYR)\b/,
      map: (s, m) => m[1] === 'GBP' ? '£' : m[1] === 'EUR' ? '€' : m[1] },
  ];
  for (const { re, map } of patterns) {
    const m = summary.match(re);
    if (m) return map(m[0], m);
  }
  // Hierarchy 4: currency code as whole word in filename line.
  const fileLines = summary
    .split('\n')
    .filter(l => l.includes('DATA SOURCE'));
  for (const line of fileLines) {
    const m = line.match(/\b(GBP|USD|EUR|AUD|SGD|AED|MYR)\b/i);
    if (m) {
      const code = m[1].toUpperCase();
      return code === 'GBP' ? '£' : code === 'EUR' ? '€' : code;
    }
  }
  // Hierarchy 5: no confident detection — return null
  return null;
}

function derivePatterns(findings) {
  try {
    const patterns = [];

    // Group by rootCause — emit one entry if group has >= 2 findings
    const byCause = {};
    for (const f of findings) {
      const key = f.rootCause;
      if (key) {
        if (!byCause[key]) byCause[key] = [];
        byCause[key].push(f);
      }
    }
    for (const [cause, group] of Object.entries(byCause)) {
      if (group.length >= 2) {
        patterns.push({ signal: 'rootCause', value: cause, count: group.length });
      }
    }

    // Group by severity — emit one entry if group has >= 2 findings
    const bySeverity = {};
    for (const f of findings) {
      const key = f.severity;
      if (key) {
        if (!bySeverity[key]) bySeverity[key] = [];
        bySeverity[key].push(f);
      }
    }
    for (const [sev, group] of Object.entries(bySeverity)) {
      if (group.length >= 2) {
        patterns.push({ signal: 'severity', value: sev, count: group.length });
      }
    }

    return patterns;
  } catch {
    return [];
  }
}

app.post('/api/scan', async (req, res) => {
  try {
    const { dataSummary, scanType, domain } = req.body;

    if (!dataSummary) {
      return res.status(400).json({ error: 'dataSummary is required' });
    }

    const KEY = getApiKey();
    if (!KEY) {
      return res.status(500).json({ error: 'API key not configured. Add ANTHROPIC_API_KEY to .env and restart.' });
    }

    const cappedSummary = dataSummary
      ? dataSummary.slice(0, 18000).replace(/\s+\S*$/, '') + (dataSummary.length > 18000 ? '...' : '')
      : '';
    const detectedCurrency = detectCurrency(cappedSummary);

    const isRevenue = scanType === 'revenue';
    const scanInstructions = isRevenue ? REVENUE_SCAN_PROMPT_SERVER(domain, detectedCurrency) : SCAN_PROMPT_SERVER(domain, detectedCurrency);

    const systemPrompt = scanInstructions;

    const userContent = isRevenue
      ? `Run a full Revenue Intelligence Scan on this operational data:\n\n${cappedSummary}`
      : `Run a full Enterprise Scan on this operational data:\n\n${cappedSummary}`;

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = message.content[0].text.trim();
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const expectedKey = scanType === 'revenue' ? 'opportunities' : 'findings';
    function isValidScanOutput(str) {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed[expectedKey]) && parsed[expectedKey].length > 0;
      } catch {
        return false;
      }
    }
    if (!isValidScanOutput(clean)) {
      console.warn('[/api/scan] Attempt 1 failed validation — retrying once');
      try {
        const retry = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        });
        const retryRaw = retry.content[0].text.trim();
        const retryClean = retryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        if (!isValidScanOutput(retryClean)) {
          console.warn('[/api/scan] Retry also failed validation — returning error');
          return res.status(422).json({ error: 'scan_output_invalid', text: retryRaw });
        }
        let retryDerivedPatterns = [];
        try {
          const retryParsedForPatterns = JSON.parse(retryClean);
          const retryFindingsForPatterns = Array.isArray(retryParsedForPatterns.findings) ? retryParsedForPatterns.findings : [];
          retryDerivedPatterns = derivePatterns(retryFindingsForPatterns);
        } catch { retryDerivedPatterns = []; }
        return res.status(200).json({ text: retryClean, patterns: retryDerivedPatterns });
      } catch (retryErr) {
        console.error('[/api/scan] Retry threw:', retryErr.message);
        return res.status(422).json({ error: 'scan_output_invalid', text: raw });
      }
    }
    let derivedPatterns = [];
    try {
      const parsedForPatterns = JSON.parse(clean);
      const findingsForPatterns = Array.isArray(parsedForPatterns.findings) ? parsedForPatterns.findings : [];
      derivedPatterns = derivePatterns(findingsForPatterns);
    } catch { derivedPatterns = []; }
    return res.status(200).json({ text: clean, patterns: derivedPatterns });
  } catch (err) {
    console.error('[/api/scan error]', err.message, err.stack);
    return res.status(500).json({ error: err.message || 'Scan failed. Please try again.' });
  }
});

function buildContextBlock(ctx) {
  try {
    const lines = [];
    lines.push(`[SCAN CONTEXT — as of ${ctx.scannedAt || 'latest scan'}]`);
    if (ctx.scanType) lines.push(`Scan type: ${ctx.scanType}`);
    if (ctx.domain) lines.push(`Domain: ${ctx.domain}`);
    if (ctx.totalExposure) lines.push(`Total financial exposure identified: ${ctx.totalExposure}`);
    if (Array.isArray(ctx.findings) && ctx.findings.length > 0) {
      lines.push('Findings:');
      ctx.findings.slice(0, 3).forEach((f, i) => {
        const title = f.title || 'Untitled';
        const severity = f.severity || '';
        const impact = f.impact || '';
        const evidence = f.evidence
          ? (f.evidence.length > 250 ? f.evidence.slice(0, 250).replace(/\S*$/, '').trim() + '...' : f.evidence)
          : '';
        const fix = f.fix
          ? (f.fix.length > 300 ? f.fix.slice(0, 300).replace(/\S*$/, '').trim() + '...' : f.fix)
          : '';
        lines.push(`${i + 1}. [${severity}] ${title} — Impact: ${impact}`);
        if (evidence) lines.push(`   Evidence: ${evidence}`);
        if (fix) lines.push(`   Recommended fix: ${fix}`);
      });
    }
    if (ctx.dataSummary && typeof ctx.dataSummary === 'string' && ctx.dataSummary.trim() !== '') {
      const capped = ctx.dataSummary.length > 1200
        ? ctx.dataSummary.slice(0, 1200).replace(/\S*$/, '').trim() + '...'
        : ctx.dataSummary.trim();
      lines.push('');
      lines.push('[UPLOADED DATA SUMMARY]');
      lines.push(capped);
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

app.post('/api/chief', async (req, res) => {
  try {
    const { message, chiefContext } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message field is required' });
    }
    const KEY = getApiKey();
    if (!KEY) {
      return res.status(500).json({ error: 'API key not configured.' });
    }
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: KEY });
    const chiefSystemPrompt = `You are DAO Chief, the decision intelligence advisor for this organisation. You reason in four internal steps before answering. The CEO never sees your reasoning — only your final answer.

Work through these steps internally:
STEP 1 – DATA TRUTH: What do we actually know from the data and context provided?
STEP 2 – CURRENT REALITY: How is the organisation currently handling this?
STEP 3 – IMPACT QUANTIFICATION: What is the financial or operational impact?
STEP 4 – ASSUMPTION CHECK: What assumptions does this analysis depend on?

Before writing your final answer, classify the user's request into one of three types and apply the corresponding length rule:
- FACTUAL / YES-NO / CONFIRMATION: answer in 1–2 sentences maximum. No elaboration unless asked.
- TACTICAL / SINGLE-ISSUE: answer in 3–5 sentences maximum. Be direct and specific.
- STRATEGIC / MULTI-FACTOR / ANALYSIS: answer in up to 3 short paragraphs. Be concise. No redundancy. No long lists unless the request explicitly requires enumeration.
Do not state which type you selected. Apply the rule silently.

After completing all four steps, output your final answer using this exact format:
RESPONSE:
[Your CEO-ready answer here]

The RESPONSE: marker must appear on its own line. Everything before it is internal reasoning and will be stripped. Never include STEP labels in your final answer.`;
    const hasContext = chiefContext &&
      Array.isArray(chiefContext.findings) &&
      chiefContext.findings.length > 0;
    const contextBlock = hasContext ? buildContextBlock(chiefContext) : '';
    const userContent = hasContext
      ? contextBlock + '\n\n[CEO QUESTION]\n' + message
      : message;
    const apiMessage = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0,
      system: chiefSystemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });
    const raw = apiMessage.content[0].text;
    const markerIndex = raw.indexOf('RESPONSE:');
    if (markerIndex === -1) {
      return res.status(200).json({ text: 'I was unable to generate a response. Please try again.' });
    }
    const text = raw.slice(markerIndex + 'RESPONSE:'.length).trim();
    return res.status(200).json({ text });
  } catch (err) {
    console.error('[/api/chief error]', err.message);
    const isContextLengthError = err.message && (
      err.message.includes('prompt is too long') ||
      err.message.includes('maximum context length') ||
      err.message.includes('too many tokens')
    );
    const safeError = isContextLengthError
      ? 'This question contains too much context to process. Please try a shorter or more specific question.'
      : err.message;
    return res.status(500).json({ error: safeError });
  }
});

// SPA fallback — serve index.html for all non-API routes (Express 5 syntax)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(distPath, "index.html"));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const key = getApiKey();
  console.log();
  console.log("  Decision Accountability OS");
  console.log("  Built by 30GENS");
  console.log("  ───────────────────────────────────");
  console.log(`  Running at:  http://localhost:${PORT}`);
  console.log(`  API status:  ${key ? "Ready" : "NOT CONFIGURED"}`);
  if (!key) {
    console.log();
    console.log("  To enable live AI:");
    console.log("  1. Open .env in this folder");
    console.log("  2. Set ANTHROPIC_API_KEY=sk-ant-...");
    console.log("  3. Restart the server");
  }
  console.log();
});
