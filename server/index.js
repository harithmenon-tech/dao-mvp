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
