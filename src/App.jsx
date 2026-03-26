import { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { upgradedDecision, validateDecision, bumpVersion, logAudit, saveJournal } from './dao-storage.js';
import { detectPatterns, savePatterns, loadPatterns, findMatchingPatterns } from './patternMemory';
import BriefView from './BriefView.jsx';
import domainRegistry from './domain/domainRegistry.js';
import { getScanOverlay } from './domain/domainContextInjector.js';
import { createDatasetRecord, classifySuggestDomain, saveDatasetRegistry, loadDatasetRegistry } from './core/data/datasetRegistry.js';
import { getIncludedDatasets, buildValidationReport } from './core/scan/scanRouter.js';
import { DOMAINS, getDomain, DEFAULT_DOMAIN } from './domainConfig';
import ShellFrame from './components/ShellFrame.jsx';
import OpeningMoment from './components/OpeningMoment.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import DataConnection from './components/DataConnection.jsx';
import SituationQueue from './components/SituationQueue.jsx';
import EmptyState from './components/EmptyState.jsx';

// ═══════════════════════════════════════════════════════════════
// DECISION ACCOUNTABILITY OS — MVP
// Built by 30GENS | Powered by Claude API
// ═══════════════════════════════════════════════════════════════

const ACCENT = "#0EA5E9";
const ACCENT_DIM = "#0284C7";
const BG_DARK = "#0B1120";
const BG_CARD = "#111827";
const BG_SURFACE = "#1E293B";
const BORDER = "#1E3A5F";
const TEXT = "#E2E8F0";
const TEXT_DIM = "#94A3B8";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const GOLD = "#F59E0B";
const VERDICT_COLOR = { "On Track": GREEN, "Variance Noted": AMBER, "Off Track": RED, "Cancelled": TEXT_DIM };

// Demo mode starts true (safe default). Gets flipped to false when API health check passes.
let DEMO_MODE = true;

// System prompt layers from Product Intelligence Document
const IDENTITY_PROMPT = `You are the Decision Accountability OS, built by 30GENS.

You are a seasoned operator who has carried P&Ls, faced regulators, dealt with unions, angry customers, broken systems, political noise, and boards demanding results.

Your mandate: Surface truth. Force decisions. Make change stick.

You are not neutral. You challenge assumptions. You say when the problem is leadership, not systems. You say when governance is performative. You say when "later" is the most expensive decision.

ABSOLUTE RULES:
- Never assume. State assumptions explicitly. Ask the CEO to qualify them.
- Every recommendation includes: evidence it is based on, assumptions it depends on, confidence level.
- If evidence is thin, say so. Never fill gaps with plausible generalities.
- You recommend. The human decides. Always.
- When you identify a finding, quantify the financial impact in specific currency amounts, not percentages.
- Present confidence as HIGH, MODERATE, or LOW with one-line reasoning.`;

const DIAGNOSTIC_CHAIN = `DIAGNOSTIC REASONING CHAIN — Apply to EVERY substantive question:

STEP 1 - DATA TRUTH:
- Which connected data sources are relevant?
- What data gaps limit confidence?
- Any contradictions between sources?
- How recent is the data?

STEP 2 - CURRENT REALITY:
- How does the organisation currently handle this?
- Workarounds, manual processes, informal systems?
- Check Decision Journal for prior decisions on this topic.
- Who is involved in the current process?

STEP 3 - IMPACT QUANTIFICATION:
- Financial impact in specific currency amounts
- Decision velocity improvement if resolved
- Second-order effects (what else this unlocks)
- Weekly/monthly cost of inaction

STEP 4 - ASSUMPTION CHECK:
- List every assumption the analysis depends on
- Flag which are data-backed vs inferred
- Ask CEO to confirm critical assumptions

Only after all four steps: present your response.`;

const SCAN_PROMPT = `You are running an Enterprise Scan. Analyse ALL uploaded data systematically.

For each dataset, scan for these 5 pattern categories:
1. CASH TRAPS: Financial items pending beyond threshold (>30 days)
2. PROCESS LEAKS: Rework, exceptions, manual workarounds, duplicates (>3 times in 90 days)
3. CAPACITY MISMATCHES: Overloaded or idle resources (utilisation >95% or <60%)
4. RECURRING FAILURES: Same incident type repeating (>3 times in 90 days)
5. DECISION STALLS: Decisions revisited without resolution (>3 discussions, no action)

CRITICAL — CROSS-DATASET CORRELATION:
For each finding in one dataset, check ALL other datasets for correlating patterns.
If correlation found: present as SINGLE narrative with COMBINED impact.

For EVERY finding, output in this EXACT format:
FINDING [number]
PATTERN: [what is happening]
EVIDENCE: [specific data points with dates and amounts]
RECURRENCE: [frequency and period]
IMPACT: [financial + time + risk, quantified]
ROOT CAUSE: [process / people / system / governance]
FIX: [specific corrective action]
SEVERITY: [Tier 1 / Tier 2 / Tier 3]
CONFIDENCE: [HIGH / MODERATE / LOW] — [one-line reasoning]
ASSUMPTIONS: [list, flagged as data-backed or inferred]

After all findings, provide:
SCAN SUMMARY
- Total findings count
- Total financial exposure identified
- Top 3 priority actions
- Data gaps that limit the analysis`;

const INDUSTRY_UPLOAD_GUIDANCE = {
  "Biotech": {
    title: "Biotech — Revenue Intelligence Data",
    items: ["Clinical outcome datasets (anonymised)", "Doctor interaction logs or CRM exports", "Research partnership agreements", "Product pricing history and discount records", "Regulatory approval timelines and cost records", "Competitor pricing benchmarks if available"]
  },
  "Healthcare": {
    title: "Healthcare — Revenue Intelligence Data",
    items: ["Patient pathway and service utilisation data", "Referral source and conversion records", "Pricing schedules and insurance reimbursement rates", "Unutilised equipment or facility capacity reports", "Staff skill and certification records", "Partnership or supplier contracts"]
  },
  "Construction": {
    title: "Construction — Revenue Intelligence Data",
    items: ["Project cost vs budget variance history", "Subcontractor performance and payment records", "Material procurement and waste logs", "Delay and variation order history", "Client satisfaction or defect liability records", "Equipment utilisation and idle time reports"]
  },
  "Manufacturing": {
    title: "Manufacturing — Revenue Intelligence Data",
    items: ["Production yield and defect rate history", "Machine utilisation and downtime logs", "Raw material cost and supplier performance data", "Customer order patterns and demand forecasts", "Warranty claim and return records", "Excess inventory and obsolescence reports"]
  },
  "Transport": {
    title: "Supply Chain — Revenue Intelligence Data",
    items: ["Supplier lead time and reliability records", "Inventory turnover and stockout history", "Freight cost and carrier performance data", "Order fulfilment cycle time reports", "Returns and reverse logistics data", "Customer delivery SLA compliance records"]
  },
  "Property": {
    title: "Property Development — Revenue Intelligence Data",
    items: ["Project sales velocity and pricing by unit type", "Buyer profile and source-of-buyer data", "Construction cost vs sales price margin history", "Unsold inventory aging reports", "Rental yield data for completed projects", "Agent commission and channel performance records"]
  },
  "Financial": {
    title: "Financial Services — Revenue Intelligence Data",
    items: ["Product cross-sell and upsell conversion records", "Client lifetime value and churn history", "Fee schedule and discount approval logs", "Dormant account or underutilised product data", "Relationship manager activity and portfolio reports", "Competitor product benchmarks if available"]
  },
  "Technology": {
    title: "Technology — Revenue Intelligence Data",
    items: ["Product usage and feature adoption logs", "Customer support ticket categories and volume", "Pricing tier and upgrade/downgrade history", "Partner or reseller performance records", "Churn reasons and win/loss interview data", "API or integration usage data"]
  },
  "default": {
    title: "Revenue Intelligence — Recommended Data",
    items: ["Customer contracts and pricing history", "Sales and revenue records by product or service", "Customer interaction and support logs", "Supplier and partner agreements", "Operational cost and margin data", "Any market or competitor benchmarks available"]
  }
};

const REVENUE_SCAN_PROMPT = `You are running a Revenue Intelligence Scan. Your mandate is different from an operational scan. You are NOT looking for problems. You are looking for MONEY LEFT ON THE TABLE — data assets, relationships, service gaps, whitelabel opportunities, and pricing leakage that represent untapped revenue for this organisation.

Scan ALL uploaded data for these 5 revenue opportunity categories:

1. DATA ASSETS: Unique data this organisation owns that partners, regulators, researchers, or competitors would pay for.
2. RELATIONSHIP VALUE: Under-monetised customer, partner, supplier, or ecosystem relationships.
3. SERVICE GAPS: Places where customers are paying for workarounds this organisation could solve with a product or service.
4. WHITELABEL POTENTIAL: Internal processes, tools, or knowledge that could be packaged and sold to others in the same industry.
5. PRICING LEAKAGE: Places where value is being delivered but not charged for, or discounts applied without justification.

INDUSTRY-SPECIFIC LENS:
— Biotech: Clinical data licensing, research partnerships, doctor-to-patient relationship monetisation.
— Healthcare: Pathway data value, referral network monetisation, premium service tiers.
— Construction: Project intelligence data, subcontractor network value, methodology whitelabelling.
— Manufacturing: Yield data benchmarking, supplier intelligence, excess capacity monetisation.
— Supply Chain/Logistics: Route and supplier intelligence, fulfilment benchmarking, value-added service gaps.
— Property Development: Buyer data value, channel performance intelligence, inventory yield optimisation.
— Financial Services: Cross-sell data patterns, fee recovery, dormant relationship reactivation.
— Technology: Usage data licensing, API monetisation, feature-to-tier upgrade triggers.

For EVERY opportunity found, output in this EXACT format:

OPPORTUNITY [number]
CATEGORY: [Data Assets / Relationship Value / Service Gap / Whitelabel Potential / Pricing Leakage]
PATTERN: [what the opportunity is — one clear sentence]
EVIDENCE: [specific data points from uploaded files with values where available]
REVENUE POTENTIAL: [estimated value in currency — give a range, show your working]
TIMEFRAME: [Quick Win (0-90 days) / Medium Term (3-12 months) / Strategic (12+ months)]
ACTION: [the single most important next step to capture this opportunity]
CONFIDENCE: [HIGH / MODERATE / LOW] — [one-line reasoning]
ASSUMPTIONS: [list, flagged as data-backed or inferred]

After all opportunities provide:
REVENUE INTELLIGENCE SUMMARY
— Total opportunities identified
— Total revenue potential range
— Top 3 quick wins
— Data gaps that would sharpen this analysis`;

const STYLE_PROMPTS = {
  direct: "Communication style: DIRECT. Lead with the problem. State impact in numbers. Two options max. No softening. Ask for a decision.",
  solution: "Communication style: SOLUTION-FIRST. Lead with your recommendation. Then explain why. Then show evidence. Ask: 'Shall I proceed?'",
  balanced: "Communication style: BALANCED. Present situation. 2-3 options with trade-offs. State your recommendation without presuming."
};

// ═══════════════════════════════════════════════════════════════
// STORAGE HELPERS (localStorage-backed)
// ═══════════════════════════════════════════════════════════════
const store = {
  get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key, val) {
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error("Storage error:", e);
    }
  },
  del(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
};

// ── confidenceLabel — maps confidenceScore integer to display label ──
function confidenceLabel(score) {
  const s = Number(score);
  if (s >= 4) return "HIGH";
  if (s === 3) return "MODERATE";
  if (s >= 1) return "LOW";
  return "MODERATE";
}

// ── loadJournal — reads decision journal from localStorage ──────
function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem('dao-journal') || '[]');
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE API — with timeouts and proper error handling
// ═══════════════════════════════════════════════════════════════
async function callClaude(systemPrompt, messages, onChunk) {
  if (DEMO_MODE) {
    const full = mockAssistant(systemPrompt, messages);
    let i = 0;
    return await new Promise((resolve) => {
      const tick = () => {
        i = Math.min(full.length, i + Math.max(12, Math.floor(full.length / 120)));
        onChunk?.(full.slice(0, i));
        if (i >= full.length) return resolve(full);
        setTimeout(tick, 25);
      };
      tick();
    });
  }

  // Live mode: call backend proxy with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

  try {
    const resp = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, messages, stream: true }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      let errMsg;
      try {
        const errData = await resp.json();
        errMsg = errData.error || `API error (${resp.status})`;
      } catch {
        errMsg = await resp.text().catch(() => `API error (${resp.status})`);
      }
      throw new Error(errMsg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            full += parsed.text;
            onChunk?.(full);
          }
        } catch (e) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }
    return full;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try a shorter question or check your connection.");
    }
    throw err;
  }
}

// ── Retry wrapper for 429 rate-limit responses ───────────────────
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const wait = (i + 1) * 8000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("Rate limited after retries. Please wait 30 seconds and try again.");
}

async function callClaudeSync(systemPrompt, messages) {
  if (DEMO_MODE) return mockAssistant(systemPrompt, messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const resp = await fetchWithRetry("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, messages, stream: false }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      let errMsg;
      try {
        const errData = await resp.json();
        errMsg = errData.error || `API error (${resp.status})`;
      } catch {
        errMsg = `API error (${resp.status})`;
      }
      throw new Error(errMsg);
    }

    const data = await resp.json();
    return data.text || "";
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  }
}

function mockAssistant(systemPrompt, messages) {
  const last = (messages || []).slice().reverse().find(m => m.role === "user")?.content || "";
  const wantsScan = /enterprise scan|run scan|scan/i.test(last);
  const base = `I will follow the diagnostic chain.\n\n`;
  if (wantsScan) {
    return base + `FINDING 1
PATTERN: Vendor invoices are ageing beyond 30 days, creating a cash trap.
EVIDENCE: Sample shows multiple items >30 days (see uploaded dataset ageing fields). Amounts cluster around the same vendors.
RECURRENCE: Repeats weekly across the last 90 days.
IMPACT: Estimated RM 180,000 - RM 320,000 cash tied up; plus late-payment risk.
ROOT CAUSE: Approval workflow stalls + unclear decision owner.
FIX: Set a single decision owner; introduce 48-hour escalation; auto-approve under threshold with audit trail.
SEVERITY: Tier 1
CONFIDENCE: MODERATE — demo mode inference from sample rows.
ASSUMPTIONS: Ageing column reflects invoice age (inferred); currency is RM (inferred)

FINDING 2
PATTERN: Duplicate exception handling indicates process leaks.
EVIDENCE: Similar 'exception' or 'rework' notes appear multiple times for same record identifiers.
RECURRENCE: >3 times within 90 days.
IMPACT: RM 40,000 - RM 90,000 labour-equivalent cost per quarter; slower cycle times.
ROOT CAUSE: Manual workarounds around missing master data.
FIX: Add master-data validation at ingestion; block incomplete records.
SEVERITY: Tier 2
CONFIDENCE: LOW — needs more structured data.
ASSUMPTIONS: Duplicate IDs represent the same case (inferred)

SCAN SUMMARY
- Total findings count: 2
- Total financial exposure identified: RM 220,000 - RM 410,000
- Top 3 priority actions: (1) Name the decision owner, (2) implement escalation SLA, (3) fix master-data validation
- Data gaps that limit the analysis: Missing timestamps, owner fields, and cost-of-delay assumptions.`;
  }
  return base + `What decision are you trying to make right now?

1) The decision statement (one sentence)
2) The options on the table (2-3 max)
3) What data you have (or can upload)
4) When this decision becomes expensive if delayed`;
}

// ═══════════════════════════════════════════════════════════════
// FILE PARSING
// ═══════════════════════════════════════════════════════════════
function isMeterExport(filename) {
  const n = (filename || '').toLowerCase();
  return n.includes('meter') || n.includes('wtw') ||
         n.includes('ami') || n.includes('amr') || n.includes('telemetry');
}
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".tsv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        ...(isMeterExport(file.name) && {
          beforeFirstChunk: (chunk) => chunk.split('\n').slice(7).join('\n')
        }),
        complete: (r) => resolve({ name: file.name, type: "csv", rows: r.data, headers: r.meta.fields, rowCount: r.data.length }),
        error: reject
      });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheets = {};
          let totalRows = 0;
          wb.SheetNames.forEach(sn => {
            // Read as raw array-of-arrays to support non-standard meter file headers
            const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });

            // Header detection: iterate from row 0, ignore rows with < 10 populated cells,
            // use the first row with >= 10 non-empty cells as the header row
            let headerRowIdx = -1;
            for (let i = 0; i < rawRows.length; i++) {
              const populated = rawRows[i].filter(
                cell => cell !== null && cell !== undefined && String(cell).trim() !== ''
              ).length;
              if (populated >= 10) {
                headerRowIdx = i;
                break;
              }
            }

            if (headerRowIdx === -1) {
              sheets[sn] = {
                rows: [],
                headers: [],
                rowCount: 0,
                error: 'Could not detect header row — no row with 10 or more populated cells found',
              };
              return;
            }

            const headers = rawRows[headerRowIdx].map(h => String(h));
            const dataRows = rawRows.slice(headerRowIdx + 1).map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
              return obj;
            });

            sheets[sn] = { rows: dataRows, headers, rowCount: dataRows.length };
            totalRows += dataRows.length;
          });
          resolve({ name: file.name, type: "excel", sheets, sheetNames: wb.SheetNames, totalRows });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ name: file.name, type: "text", content: e.target.result, charCount: e.target.result.length });
      reader.readAsText(file);
    }
  });
}

function classifyDataset(name) {
  const n = (name || '').toLowerCase();
  if (/billing|invoice|billed|receivable|charges|revenue_detail/.test(n)) return 'BILLING';
  if (/tariff|rate|pricing|schedule|price_list|rate_card/.test(n)) return 'TARIFF';
  return null;
}


function summarizeData(datasets, fullScan = false) {
  if (!Array.isArray(datasets)) return "";
  let summary = "";
  datasets.forEach((ds, i) => {
    if (!ds || !ds.name) return;
    const classification = classifyDataset(ds.name);
    const classTag = classification ? ` [CLASSIFIED: ${classification}]` : '';
    summary += `\n--- DATA SOURCE ${i + 1}: ${ds.name}${classTag} ---\n`;
    if (ds.type === "csv") {
      const headers = Array.isArray(ds.headers) ? ds.headers : [];
      const rows = Array.isArray(ds.rows) ? ds.rows : [];
      summary += `Type: CSV | Rows: ${ds.rowCount || 0} | Columns: ${headers.join(", ")}\n`;
      const sample = rows.slice(0, fullScan ? 15 : 3);
      summary += `Sample (${sample.length} rows):\n${JSON.stringify(sample, null, 1)}\n`;
    } else if (ds.type === "excel") {
      const sheetNames = Array.isArray(ds.sheetNames) ? ds.sheetNames : [];
      const sheets = ds.sheets || {};
      sheetNames.forEach(sn => {
        const sh = sheets[sn];
        if (!sh) return;
        const headers = Array.isArray(sh.headers) ? sh.headers : [];
        const rows = Array.isArray(sh.rows) ? sh.rows : [];
        summary += `Sheet "${sn}": ${sh.rowCount || 0} rows | Columns: ${headers.join(", ")}\n`;
        const sample = rows.slice(0, fullScan ? 15 : 3);
        summary += `Sample:\n${JSON.stringify(sample, null, 1)}\n`;
      });
    } else {
      summary += `Type: Text | Length: ${ds.charCount || 0} chars\n`;
      summary += (ds.content || "").substring(0, 2000) + "\n";
    }
  });
  return summary;
}

function parseRevenueFindings(text) {
  if (!text) return [];
  const opportunities = [];
  const parts = text.split(/(?=OPPORTUNITY\s+\d+)/i);
  parts.forEach((section) => {
    if (!section.trim() || !section.match(/^OPPORTUNITY\s+\d+/i)) return;
    const getField = (label) => {
      const upper = section.toUpperCase();
      const idx = upper.indexOf(label.toUpperCase() + ":");
      if (idx === -1) return "";
      return section.slice(idx + label.length + 1).split("\n")[0].trim();
    };
    const numMatch = section.match(/OPPORTUNITY\s+(\d+)/i);
    const potential = getField("REVENUE POTENTIAL");
    const amounts = [...(potential.match(/[\d,]+/g) || [])].map(n => parseInt(n.replace(/,/g, ""))).filter(n => n > 999);
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const timeframe = getField("TIMEFRAME");
    const opp = {
      id: numMatch ? parseInt(numMatch[1]) : opportunities.length + 1,
      category: getField("CATEGORY"),
      pattern: getField("PATTERN"),
      evidence: getField("EVIDENCE"),
      potential, timeframe,
      action: getField("ACTION"),
      confidence: getField("CONFIDENCE"),
      assumptions: getField("ASSUMPTIONS"),
      maxAmount,
      isQuickWin: /quick win|0.90|0–90/i.test(timeframe)
    };
    if (opp.pattern) opportunities.push(opp);
  });
  return opportunities;
}

// ─── Transform layer ────────────────────────────────────────────────────────
// /api/scan now returns structured JSON; parseFindings/parseRevenueFindings
// expect the original labelled-text format (FINDING N / OPPORTUNITY N).
// This function converts the JSON shape → text shape so the existing card
// renderers continue to work without any UI changes.
function transformScanJsonToText(raw) {
  if (!raw) return raw;
  try {
    const data = JSON.parse(raw);

    // Operational scan: { findings: [...] }
    if (data.findings && Array.isArray(data.findings)) {
      return data.findings.map((f, i) => [
        `FINDING ${f.number || i + 1}`,
        `PATTERN: ${f.title || f.pattern || ''}`,
        `EVIDENCE: ${f.evidence || ''}`,
        `RECURRENCE: ${f.recurrence || ''}`,
        `IMPACT: ${f.impact || ''}`,
        `ROOT CAUSE: ${f.rootCause || ''}`,
        `FIX: ${f.fix || ''}`,
        `SEVERITY: ${f.severity || 'Tier 2'}`,
        `CONFIDENCE: ${f.confidence || ''}${f.confidenceReason ? ' — ' + f.confidenceReason : ''}`,
        `ASSUMPTIONS: ${Array.isArray(f.assumptions) ? f.assumptions.join('; ') : (f.assumptions || '')}`,
      ].join('\n')).join('\n\n');
    }

    // Revenue scan: { opportunities: [...] }
    if (data.opportunities && Array.isArray(data.opportunities)) {
      return data.opportunities.map((o, i) => [
        `OPPORTUNITY ${o.number || i + 1}`,
        `CATEGORY: ${o.category || ''}`,
        `PATTERN: ${o.pattern || ''}`,
        `EVIDENCE: ${o.evidence || ''}`,
        `REVENUE POTENTIAL: ${o.revenuePotential || ''}`,
        `TIMEFRAME: ${o.timeframe || ''}`,
        `ACTION: ${o.action || ''}`,
        `CONFIDENCE: ${o.confidence || ''}${o.confidenceReason ? ' — ' + o.confidenceReason : ''}`,
        `ASSUMPTIONS: ${Array.isArray(o.assumptions) ? o.assumptions.join('; ') : (o.assumptions || '')}`,
      ].join('\n')).join('\n\n');
    }
  } catch {
    // Not JSON (plain-text fallback or error string) — pass through unchanged
  }
  return raw;
}
// ────────────────────────────────────────────────────────────────────────────

function parseFindings(text) {
  if (!text) return [];
  // Don't try to parse if text contains errors or doesn't have FINDING pattern
  if (/^Error/i.test(text) || !/FINDING\s+\d+/i.test(text)) return [];

  try {
    const findings = [];
    const parts = text.split(/(?=FINDING\s+\d+)/i);
    if (!parts || parts.length === 0) return [];

    parts.forEach((section) => {
      if (!section.trim() || !section.match(/^FINDING\s+\d+/i)) return;
      const getField = (label) => {
        const upper = section.toUpperCase();
        const searchLabel = label.toUpperCase() + ":";
        const idx = upper.indexOf(searchLabel);
        if (idx === -1) return "";
        const after = section.slice(idx + searchLabel.length);
        return after.split("\n")[0].trim();
      };
      const numMatch = section.match(/FINDING\s+(\d+)/i);
      const severity = getField("SEVERITY");
      const tierMatch = severity.match(/Tier\s*(\d)/i);
      const tier = tierMatch ? tierMatch[1] : "2";
      const impact = getField("IMPACT");
      const amounts = [...(impact.match(/[\d,]+/g) || [])].map(n => parseInt(n.replace(/,/g, ""))).filter(n => n > 999);
      const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
      const dailyCost = maxAmount > 0 ? Math.round(maxAmount / 30) : 0;
      const finding = {
        id: numMatch ? parseInt(numMatch[1]) : findings.length + 1,
        pattern: getField("PATTERN"),
        evidence: getField("EVIDENCE"),
        recurrence: getField("RECURRENCE"),
        impact,
        rootCause: getField("ROOT CAUSE"),
        fix: getField("FIX"),
        tier,
        confidence: getField("CONFIDENCE"),
        assumptions: getField("ASSUMPTIONS"),
        maxAmount,
        dailyCost
      };
      if (finding.pattern) findings.push(finding);
    });
    return findings;
  } catch (err) {
    console.error("Error parsing findings:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// ICONS (inline SVG for zero deps)
// ═══════════════════════════════════════════════════════════════
const Icon = ({ d, size = 20, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
const DashboardIcon = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>}/>;
const ChatIcon = (p) => <Icon {...p} d={<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>}/>;
const ScanIcon = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>}/>;
const BookIcon = (p) => <Icon {...p} d={<><path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"/></>}/>;
const FileIcon = (p) => <Icon {...p} d={<><path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7z"/><polyline points="14,2 14,8 20,8"/></>}/>;
const SendIcon = (p) => <Icon {...p} d={<><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></>}/>;
const PlusIcon = (p) => <Icon {...p} d={<><path d="M12 5v14M5 12h14"/></>}/>;
const MenuIcon = (p) => <Icon {...p} d={<><path d="M3 12h18M3 6h18M3 18h18"/></>}/>;
const XIcon = (p) => <Icon {...p} d={<><path d="M18 6 6 18M6 6l12 12"/></>}/>;
const CheckIcon = (p) => <Icon {...p} d={<><polyline points="20 6 9 17 4 12"/></>}/>;
const UploadIcon = (p) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}/>;
const PaperclipIcon = (p) => <Icon {...p} d={<><path d="m21.44 11.05-9.19 9.19a6 6 0 01-8.49-8.49l8.57-8.57A4 4 0 1118 8.84l-8.59 8.57a2 2 0 01-2.83-2.83l8.49-8.48"/></>}/>;
const ClipboardIcon = (p) => <Icon {...p} d={<><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></>}/>;

function RevenueCard({ opp }) {
  const [expanded, setExpanded] = useState(false);
  const catColors = { "Data Assets": "#A78BFA", "Relationship Value": "#0EA5E9", "Service Gap": "#10B981", "Whitelabel Potential": "#F59E0B", "Pricing Leakage": "#EC4899" };
  const catColor = catColors[opp.category] || "#F59E0B";
  const timeframeColor = opp.isQuickWin ? "#10B981" : /medium/i.test(opp.timeframe) ? "#0EA5E9" : "#A78BFA";
  return (
    <div style={{ background: "#111827", border: `1px solid ${catColor}40`, borderLeft: `4px solid ${catColor}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: "#94A3B8" }}>OPP {opp.id}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${catColor}20`, color: catColor }}>{opp.category || "Opportunity"}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${timeframeColor}20`, color: timeframeColor }}>{opp.isQuickWin ? "⚡ Quick Win" : /medium/i.test(opp.timeframe) ? "Medium Term" : "Strategic"}</span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", lineHeight: 1.4, color: "#E2E8F0" }}>{opp.pattern}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: `${catColor}10`, border: `1px solid ${catColor}25`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>REVENUE POTENTIAL</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: catColor }}>{opp.maxAmount > 0 ? `RM ${opp.maxAmount.toLocaleString()}` : "See details"}</div>
        </div>
        <div style={{ background: "#10B98110", border: "1px solid #10B98125", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>TIMEFRAME</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: timeframeColor }}>{opp.timeframe.split("(")[0].trim() || "Review needed"}</div>
        </div>
      </div>
      {opp.action && (
        <div style={{ background: "#10B98110", border: "1px solid #10B98125", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 6 }}>NEXT ACTION TO CAPTURE THIS</div>
          <div style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.55 }}>{opp.action}</div>
        </div>
      )}
      <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 12, padding: 0 }}>
        {expanded ? "▲ Hide details" : "▼ Show evidence & assumptions"}
      </button>
      {expanded && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ label: "EVIDENCE", val: opp.evidence }, { label: "CONFIDENCE", val: opp.confidence }, { label: "ASSUMPTIONS", val: opp.assumptions }, { label: "FULL POTENTIAL", val: opp.potential }].filter(f => f.val).map(({ label, val }) => (
            <div key={label} style={{ background: "#1E293B", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 12, color: "#E2E8F0", lineHeight: 1.5 }}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const WORKSTREAMS_DEFAULT = [
  { name: "Leadership & Governance Alignment", status: "Not Started", pct: 0, note: "", updatedDate: "" },
  { name: "Process Redesign & Documentation", status: "Not Started", pct: 0, note: "", updatedDate: "" },
  { name: "Technology Setup & Integration", status: "Not Started", pct: 0, note: "", updatedDate: "" },
  { name: "Staff Training & Adoption", status: "Not Started", pct: 0, note: "", updatedDate: "" },
  { name: "Data Migration & Quality", status: "Not Started", pct: 0, note: "", updatedDate: "" },
  { name: "Go-Live & Stabilisation", status: "Not Started", pct: 0, note: "", updatedDate: "" }
];

function ChangeProjectCard({ project, onUpdateWorkstream }) {
  const [expanded, setExpanded] = useState(true);
  const ragColor = { "Complete": "#10B981", "In Progress": "#0EA5E9", "At Risk": "#EF4444", "Not Started": "#94A3B8" };
  const completedCount = project.workstreams.filter(w => w.status === "Complete").length;
  const atRiskCount = project.workstreams.filter(w => w.status === "At Risk").length;
  const overallPct = Math.round(project.workstreams.reduce((s, w) => s + w.pct, 0) / project.workstreams.length);
  const overallStatus = atRiskCount > 0 ? "At Risk" : completedCount === project.workstreams.length ? "Complete" : completedCount > 0 ? "In Progress" : "Not Started";
  return (
    <div style={{ background: "#111827", border: `1px solid #1E3A5F`, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>{project.name}</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{project.description}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
            <div style={{ flex: 1, height: 6, background: "#1E293B", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${overallPct}%`, height: "100%", background: ragColor[overallStatus], borderRadius: 3, transition: "width 0.4s" }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: ragColor[overallStatus], flexShrink: 0 }}>{overallPct}%</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${ragColor[overallStatus]}20`, color: ragColor[overallStatus], fontWeight: 600 }}>{overallStatus}</span>
          </div>
        </div>
        <span style={{ color: "#94A3B8", marginLeft: 12, fontSize: 14 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid #1E3A5F" }}>
          {project.workstreams.map((ws, idx) => (
            <div key={idx} style={{ padding: "12px 16px", borderBottom: idx < project.workstreams.length - 1 ? "1px solid #1E3A5F" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: ragColor[ws.status], flexShrink: 0 }}/>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0", flex: 1 }}>{ws.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: ragColor[ws.status] }}>{ws.pct}%</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {["Not Started", "In Progress", "At Risk", "Complete"].map(s => (
                  <button key={s} onClick={() => onUpdateWorkstream(project.id, idx, "status", s)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, border: `1px solid ${ws.status === s ? ragColor[s] : "#1E3A5F"}`, background: ws.status === s ? `${ragColor[s]}20` : "transparent", color: ws.status === s ? ragColor[s] : "#94A3B8", cursor: "pointer", fontWeight: ws.status === s ? 700 : 400 }}>{s}</button>
                ))}
                <input type="range" min="0" max="100" value={ws.pct} onChange={e => onUpdateWorkstream(project.id, idx, "pct", parseInt(e.target.value))} style={{ width: 80, accentColor: ragColor[ws.status] }}/>
              </div>
              <input placeholder="Add a note..." value={ws.note} onChange={e => onUpdateWorkstream(project.id, idx, "note", e.target.value)} style={{ width: "100%", background: "#1E293B", border: "1px solid #1E3A5F", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#E2E8F0", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}/>
              {ws.updatedDate && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>Updated: {ws.updatedDate}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthRing({ resolved, total }) {
  const pct = total > 0 ? resolved / total : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const strokeColor = pct >= 0.7 ? "#10B981" : pct >= 0.3 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="#1E293B" strokeWidth={10}/>
      <circle cx={45} cy={45} r={r} fill="none" stroke={strokeColor}
        strokeWidth={10} strokeDasharray={`${circ * pct} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 45 45)"/>
      <text x={45} y={41} textAnchor="middle" fill="#E2E8F0" fontSize={15} fontWeight="700" fontFamily="DM Sans, sans-serif">{Math.round(pct * 100)}%</text>
      <text x={45} y={56} textAnchor="middle" fill="#94A3B8" fontSize={8} fontFamily="DM Sans, sans-serif">RESOLVED</text>
    </svg>
  );
}

function FindingCard({ finding, resolved, onToggle, displayNumber }) {
  const FALLBACK = "Not quantified";
  const [expanded, setExpanded] = useState(false);
  const tierColor = finding.tier === "1" ? "#EF4444" : finding.tier === "2" ? "#F59E0B" : "#10B981";
  const tierLabel = finding.tier === "1" ? "TIER 1 — HIGH" : finding.tier === "2" ? "TIER 2 — MEDIUM" : "TIER 3 — LOW";
  const extractAmount = () => {
    const m = finding.impact && finding.impact.match(/RM[\s]?[\d,\s]+(?:[–\-][\s]?RM?[\s]?[\d,]+)?/i);
    return m ? m[0].trim() : finding.maxAmount > 0 ? `RM ${finding.maxAmount.toLocaleString()}` : null;
  };
  return (
    <div style={{
      background: resolved ? "#1E293B60" : "#111827",
      border: `1px solid ${resolved ? "#1E3A5F" : tierColor}40`,
      borderLeft: `4px solid ${resolved ? "#94A3B8" : tierColor}`,
      borderRadius: 12, padding: 20, marginBottom: 12,
      opacity: resolved ? 0.65 : 1, transition: "all 0.2s"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#94A3B8" }}>FINDING {displayNumber ?? finding.id}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${tierColor}20`, color: tierColor }}>{tierLabel}</span>
          {resolved && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#10B98120", color: "#10B981" }}>✓ RESOLVED</span>}
        </div>
        <button onClick={() => onToggle(finding.id)} style={{
          background: resolved ? "#10B98115" : "#0EA5E915",
          border: `1px solid ${resolved ? "#10B981" : "#0EA5E9"}40`,
          borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600,
          color: resolved ? "#10B981" : "#0EA5E9", cursor: "pointer", flexShrink: 0
        }}>{resolved ? "✓ Resolved" : "Mark Resolved"}</button>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", lineHeight: 1.4, color: "#E2E8F0" }}>{finding.pattern}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: `${tierColor}10`, border: `1px solid ${tierColor}25`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>FINANCIAL EXPOSURE</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: tierColor }}>{extractAmount() || FALLBACK}</div>
          </div>
          <div style={{ background: "#EF444410", border: "1px solid #EF444425", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>COST PER DAY UNRESOLVED</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#EF4444" }}>{finding.dailyCost > 0 ? `RM ${finding.dailyCost.toLocaleString()}` : FALLBACK}</div>
          </div>
        </div>
      <div style={{ background: "#10B98110", border: "1px solid #10B98125", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 6 }}>RECOMMENDED ACTION</div>
          <div style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.55 }}>{finding.fix || FALLBACK}</div>
        </div>
      <button onClick={() => setExpanded(!expanded)} style={{
        background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 12, padding: 0, display: "flex", alignItems: "center", gap: 4
      }}>{expanded ? "▲ Hide details" : "▼ Show evidence & root cause"}</button>
      {expanded && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "EVIDENCE", val: finding.evidence },
            { label: "ROOT CAUSE", val: finding.rootCause },
            { label: "CONFIDENCE", val: finding.confidence },
            { label: "RECURRENCE", val: finding.recurrence }
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "#1E293B", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 12, color: "#E2E8F0", lineHeight: 1.5 }}>{val || FALLBACK}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PATTERN MEMORY PANEL
// ═══════════════════════════════════════════════════════════════
function PatternMemoryPanel({ patterns }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: "16px 0", border: "1px solid #2a2a4a", borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", background: "#12122a", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0ff" }}>Pattern Memory</span>
          <span style={{ fontSize: 11, background: "#2a2a5a", color: "#8888ff",
            border: "1px solid #4a4a8a", borderRadius: 10, padding: "2px 8px" }}>
            {patterns.length}
          </span>
        </div>
        <span style={{ color: "#8888bb", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ background: "#0d0d1f", padding: "12px 16px" }}>
          {patterns.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94A3B8", padding: "8px 0" }}>
              No patterns detected yet.
            </div>
          ) : (
            patterns.map(p => (
              <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #1a1a3a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0ff" }}>{(() => { const m = p.label.match(/^(\w+):\s(.+)\s\(×\d+\)$/); if (!m) return p.label; const [, field, value] = m; if (field === "rootCause") return `Recurring root cause: ${value}`; if (field === "severity") return `Repeated severity: ${value}`; return `${field}: ${value}`; })()}</span>
                  <span style={{ fontSize: 11, color: "#8888ff", flexShrink: 0 }}>×{p.count} findings</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#666688", marginBottom: p.tags.length > 0 ? 6 : 0 }}>
                  {p.avgConfidence > 0 && <span>Avg confidence: {p.avgConfidence}</span>}
                  <span>Last seen: {new Date(p.lastSeen).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {p.evidence && (
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                    <span style={{ color: "#8888bb", fontWeight: 600 }}>Evidence: </span>{p.evidence}
                  </div>
                )}
                {p.trendDirection && (
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                    <span style={{ color: "#8888bb", fontWeight: 600 }}>Trend: </span>{p.trendDirection}
                  </div>
                )}
                {p.action && (
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                    <span style={{ color: "#8888bb", fontWeight: 600 }}>Action: </span>{p.action}
                  </div>
                )}
                {p.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {p.tags.map(t => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: "#1e293b", color: "#94A3B8", border: "1px solid #1E3A5F" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [sideOpen, setSideOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [journal, setJournal] = useState([]);
  const [chatMsgs, setChatMsgs] = useState(JSON.parse(localStorage.getItem('dao-chief-history') || '[]'));
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [micState, setMicState] = useState("idle"); // "idle" | "listening" | "error"
  const [streaming, setStreaming] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [ob, setOb] = useState({ name: "", org: "", industry: "", region: "asean", style: "" });
  const chatEnd = useRef(null);
  const fileRef = useRef(null);
  const chatFileRef = useRef(null);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengePending, setChallengePending] = useState(null);
  const [rationaleLoading, setRationaleLoading] = useState(false);
  const [checkedFlags, setCheckedFlags] = useState([]);
  const [dalErrors, setDalErrors] = useState([]);
  const [jf, setJf] = useState({ statement: "", tier: "1", type: "technical", evidence: "", assumptions: "", confidence: "moderate", expected: "", owner: "", review_date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(), reviewDays: 30, confidenceScore: 3, tagsRaw: "", lifecycleStatus: "Active" });
  const [reviewTab, setReviewTab] = useState("all");
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ verdict: "On Track", actual_outcome: "", lesson: "", variance: "", reviewNotes: "", updateStatus: "" });

  // API status: "checking" | "live" | "demo" | "error"
  const [apiStatus, setApiStatus] = useState("checking");
  const [chatFiles, setChatFiles] = useState([]);
  const [resolvedFindings, setResolvedFindings] = useState(store.get("dao-resolved-findings") || []);
  const [parsedFindings, setParsedFindings] = useState([]);
  const [scanMode, setScanMode] = useState("operational");
  const [revenueFindings, setRevenueFindings] = useState([]);
  const [revenueScanResults, setRevenueScanResults] = useState(store.get("dao-revenue-scan") || null);
  const [decisionProfile, setDecisionProfile] = useState(store.get("dao-decision-profile") || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [autoLogDecision, setAutoLogDecision] = useState(null);
  const [changeProjects, setChangeProjects] = useState(store.get("dao-change-projects") || []);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [cf, setCf] = useState({ name: "", description: "" });
  const [copilotVariance, setCopilotVariance] = useState({variance:null,confidence:null,reasoning:null,loading:false});
  const [copilotReadyIds, setCopilotReadyIds] = useState([]);
  // ── dao-situations parse (T-S0.3) ──────────────────────────────
  const rawSituations = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('dao-situations'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const situationCount = rawSituations.length;
  const singleSituationId = situationCount === 1 ? (rawSituations[0]?.id ?? null) : null;
  // ────────────────────────────────────────────────────────────────
  const [decisionHealth, setDecisionHealth] = useState(null);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [humanOverrode, setHumanOverrode] = useState(false);
  const [scanValidation, setScanValidation] = useState(null);
  const [showScanValidation, setShowScanValidation] = useState(false);
  const [patterns, setPatterns] = useState(loadPatterns());
  const [matchingPatterns, setMatchingPatterns] = useState([]);
  const [riskRadar, setRiskRadar] = useState([]);
  const [riskRadarLoading, setRiskRadarLoading] = useState(false);
  const [showRiskRadar, setShowRiskRadar] = useState(false);
  const [boardPack, setBoardPack] = useState(null);
  const [boardPackLoading, setBoardPackLoading] = useState(false);
  const [showBoardPack, setShowBoardPack] = useState(false);
  const [scanSchedule, setScanSchedule] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dao-scan-schedule')) ||
        { operational: 'manual', revenue: 'manual' };
    } catch { return { operational: 'manual', revenue: 'manual' }; }
  });
  const [situationAssessment, setSituationAssessment] = useState(null);
  const [loadingSituation, setLoadingSituation] = useState(false);
  const [autoBrief, setAutoBrief] = useState(null);
  const [commandCentreStats, setCommandCentreStats] = useState({
    lastScanTime: null,
    totalScans: 0,
    lastScanType: null
  });

  const [activeDomain, setActiveDomain] = useState(
    localStorage.getItem('dao-active-domain') || DEFAULT_DOMAIN
  );

  // Domain context — reads active domain from localStorage
  const activeDomainId = localStorage.getItem('dao-active-domain') || 'generic';
  const domainConfig = getDomain(activeDomain);

  // Health check — determines if live API is available; re-polls every 60 s
  useEffect(() => {
    const checkHealth = () => {
      fetch("/api/health", { signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then(data => {
          if (data.apiConfigured) {
            DEMO_MODE = false;
            setApiStatus("live");
          } else {
            DEMO_MODE = true;
            setApiStatus("demo");
          }
        })
        .catch(() => {
          DEMO_MODE = true;
          setApiStatus("demo");
        });
    };
    checkHealth();
    const intervalId = setInterval(checkHealth, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Load persisted state
  useEffect(() => {
    const p = store.get("dao-profile");
    const j = store.get("dao-journal");
    const d = store.get("dao-datasets-meta");
    const s = store.get("dao-scan");
    const c = store.get("dao-chat");
    if (p) setProfile(p);
    if (j) setJournal(j);
    if (d) setDatasets(d);
    if (s) setScanResults(s);
    if (c) setChatMsgs(c);
    setLoading(false);
    preloadVarianceForDueDecisions();
    const savedBrief = localStorage.getItem('dao-auto-brief');
    if (savedBrief) { try { setAutoBrief(JSON.parse(savedBrief)); } catch {} }
    loadCommandCentreStats();
  }, []);

  // Persist
  useEffect(() => { if (journal.length) store.set("dao-journal", journal);
    if (journal.length > 0) { checkDecisionHealth(); } }, [journal]);
  useEffect(() => { if (chatMsgs.length) store.set("dao-chat", chatMsgs); }, [chatMsgs]);
  useEffect(() => { localStorage.setItem('dao-chief-history', JSON.stringify(chatMsgs)); }, [chatMsgs]);
  useEffect(() => { if (scanResults) store.set("dao-scan", scanResults); }, [scanResults]);
  useEffect(() => { if (scanResults?.text) setParsedFindings(parseFindings(scanResults.text)); }, [scanResults]);
  useEffect(() => { if (revenueScanResults?.text) setRevenueFindings(parseRevenueFindings(revenueScanResults.text)); }, [revenueScanResults]);
  useEffect(() => { if (revenueScanResults) store.set("dao-revenue-scan", revenueScanResults); }, [revenueScanResults]);
  useEffect(() => { store.set("dao-resolved-findings", resolvedFindings); }, [resolvedFindings]);
  useEffect(() => { store.set("dao-change-projects", changeProjects); }, [changeProjects]);
  useEffect(() => {
    localStorage.setItem('dao-active-domain', activeDomain);
  }, [activeDomain]);
  useEffect(() => {
    if (location.pathname === "/board") {
      setChatInput("Draft a board narrative for the current situation.");
      navigate("/chat", { replace: true });
    }
  }, [location.pathname]);

  const addChangeProject = () => {
    if (!cf.name) return;
    const project = {
      id: `CP-${Date.now().toString(36).toUpperCase()}`,
      name: cf.name,
      description: cf.description,
      startDate: new Date().toISOString().split("T")[0],
      workstreams: WORKSTREAMS_DEFAULT.map(w => ({ ...w }))
    };
    setChangeProjects(prev => [project, ...prev]);
    setShowChangeForm(false);
    setCf({ name: "", description: "" });
  };

  const updateWorkstream = (projectId, wsIdx, field, value) => {
    setChangeProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated = [...p.workstreams];
      updated[wsIdx] = { ...updated[wsIdx], [field]: value, updatedDate: new Date().toISOString().split("T")[0] };
      return { ...p, workstreams: updated };
    }));
  };

  const toggleResolvedFinding = (id) => {
    setResolvedFindings(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  useEffect(() => { if (datasets.length) store.set("dao-datasets-meta", datasets.map(d => ({ name: d.name, type: d.type, rowCount: d.totalRows || d.rowCount || 0 }))); }, [datasets]);

  // Auto-scroll chat
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, streaming]);
  useEffect(() => {
  const domainConfig = getDomain(activeDomain);
  console.log('[DAO] Active domain:', domainConfig.id, '(' + domainConfig.label + ')');
}, [activeDomain]);

  // Build system prompt
  const buildSystemPrompt = useCallback(() => {
    if (!profile) return IDENTITY_PROMPT;
    const styleLine = STYLE_PROMPTS[profile.style] || STYLE_PROMPTS.balanced;
    const dataSummary = datasets.length > 0
      ? `\n\nCONNECTED DATA SOURCES:\n${datasets.map(d => `- ${d.name} (${d.type}, ~${d.totalRows || d.rowCount || 0} records)`).join("\n")}`
      : "\n\nNo data sources connected yet. If the CEO asks analytical questions, note that data needs to be uploaded first.";
    const journalContext = journal.length > 0
      ? `\n\nDECISION JOURNAL (${journal.length} entries):\n${journal.slice(-5).map(j => `[${j.date}] ${j.statement} — Status: ${j.status}, Tier: ${j.tier}`).join("\n")}`
      : "";
    return `${IDENTITY_PROMPT}\n\n${styleLine}\n\nCEO PROFILE:\nName: ${profile.name}\nOrganisation: ${profile.org}\nIndustry: ${profile.industry}\nRegion: ${profile.region}\n${dataSummary}${journalContext}\n\n${DIAGNOSTIC_CHAIN}`;
  }, [profile, datasets, journal]);

  // ═══════════ ONBOARDING ═══════════
  const completeOnboarding = () => {
    const p = { ...ob, createdAt: new Date().toISOString() };
    setProfile(p);
    store.set("dao-profile", p);
    // Set active domain based on selected industry
    const isWater = p.industry && p.industry.toLowerCase().includes("water");
    localStorage.setItem('dao-active-domain', isWater ? 'water' : 'generic');
    setActiveDomain(isWater ? 'water' : 'generic');
    const modeLabel = apiStatus === "live" ? "Live AI" : "Demo";
    setChatMsgs([{ role: "assistant", content: `Welcome, ${p.name}. I'm your Decision Accountability OS. [${modeLabel} Mode]\n\nI've configured for ${p.style === "direct" ? "Direct" : p.style === "solution" ? "Solution-First" : "Balanced"} communication. I'll ${p.style === "direct" ? "lead with problems and numbers — no softening" : p.style === "solution" ? "lead with recommendations, then show you why" : "present options with trade-offs and my recommendation"}.\n\n${datasets.length > 0 ? `I can see ${datasets.length} data source(s) connected. Say "Run Enterprise Scan" or ask me anything about your operations.` : "To get started, upload your data — drop Excel files, CSVs, or documents right here in chat or use the Data tab. Then I can run an Enterprise Scan to find patterns your team may have missed."}\n\nWhat would you like to explore?` }]);
  };

  if (loading) return (
    <div style={{ background: BG_DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: ACCENT, fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>Loading...</div>
    </div>
  );

  // ═══════════ ONBOARDING SCREEN ═══════════
  if (!profile) return (
    <div style={{ background: BG_DARK, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: TEXT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: ACCENT, fontWeight: 600, marginBottom: 8 }}>30GENS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Decision Accountability OS</h1>
          <p style={{ color: TEXT_DIM, marginTop: 8, fontSize: 14 }}>Surface truth. Force decisions. Make change stick.</p>
          {apiStatus === "live" && <p style={{ color: GREEN, fontSize: 12, marginTop: 4 }}>Live AI Connected</p>}
          {apiStatus === "demo" && <p style={{ color: AMBER, fontSize: 12, marginTop: 4 }}>Demo Mode — add API key for live AI</p>}
        </div>

        {onboardStep === 0 && (
          <div style={{ background: BG_CARD, borderRadius: 16, padding: 32, border: `1px solid ${BORDER}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 24 }}>Let's configure your command centre</h2>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: TEXT_DIM, display: "block", marginBottom: 6 }}>Your Name</span>
              <input value={ob.name} onChange={e => setOb({...ob, name: e.target.value})} placeholder="e.g. Harith Menon" style={inputStyle}/>
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: TEXT_DIM, display: "block", marginBottom: 6 }}>Organisation</span>
              <input value={ob.org} onChange={e => setOb({...ob, org: e.target.value})} placeholder="e.g. PBAPP" style={inputStyle}/>
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: TEXT_DIM, display: "block", marginBottom: 6 }}>Industry</span>
              <select value={ob.industry} onChange={e => setOb({...ob, industry: e.target.value})} style={inputStyle}>
                <option value="">Select industry...</option>
                <option value="Water Utilities">Water Utilities</option>
                <option value="Transport & Logistics">Transport & Logistics</option>
                <option value="Healthcare & Diagnostics">Healthcare & Diagnostics</option>
                <option value="Property Development">Property Development</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Financial Services">Financial Services</option>
                <option value="Energy & Oil Gas">Energy & Oil/Gas</option>
                <option value="Technology">Technology</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 24 }}>
              <span style={{ fontSize: 13, color: TEXT_DIM, display: "block", marginBottom: 6 }}>Regional Context</span>
              <select value={ob.region} onChange={e => setOb({...ob, region: e.target.value})} style={inputStyle}>
                <option value="asean">ASEAN (Malaysia, Singapore, Indonesia...)</option>
                <option value="gulf">Gulf (UAE, Saudi, Qatar...)</option>
                <option value="east_africa">East Africa (Tanzania, Kenya, Uganda...)</option>
                <option value="generic">Global / Other</option>
              </select>
            </label>
            <button onClick={() => ob.name && ob.org && ob.industry && setOnboardStep(1)} disabled={!ob.name || !ob.org || !ob.industry} style={{ ...btnPrimary, width: "100%", opacity: ob.name && ob.org && ob.industry ? 1 : 0.4 }}>Continue</button>
          </div>
        )}

        {onboardStep === 1 && (
          <div style={{ background: BG_CARD, borderRadius: 16, padding: 32, border: `1px solid ${BORDER}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>One question to calibrate</h2>
            <p style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 24 }}>This shapes how I communicate with you — it can be adjusted later.</p>
            <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 24, lineHeight: 1.5 }}>When your team gives you bad news, what frustrates you more?</p>
            {[
              { key: "direct", label: "That they buried it", desc: "I want problems surfaced immediately, no sugarcoating" },
              { key: "solution", label: "That they didn't come with a solution", desc: "Don't just tell me the problem — tell me what to do" },
              { key: "balanced", label: "It depends on the situation", desc: "Give me the picture and options — I'll decide" }
            ].map(opt => (
              <button key={opt.key} onClick={() => setOb({...ob, style: opt.key})} style={{
                display: "block", width: "100%", textAlign: "left", padding: "16px 20px", marginBottom: 12,
                background: ob.style === opt.key ? `${ACCENT}15` : BG_SURFACE,
                border: `1px solid ${ob.style === opt.key ? ACCENT : BORDER}`,
                borderRadius: 12, cursor: "pointer", color: TEXT, transition: "all 0.2s"
              }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: TEXT_DIM, marginTop: 4 }}>{opt.desc}</div>
              </button>
            ))}
            <button onClick={completeOnboarding} disabled={!ob.style} style={{ ...btnPrimary, width: "100%", marginTop: 16, opacity: ob.style ? 1 : 0.4 }}>Launch My Command Centre</button>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════ HANDLE FILE UPLOAD ═══════════
  const handleFiles = async (files) => {
    const newDatasets = [...datasets];
    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        const isValid = parsed.type === 'excel'
          ? (parsed.totalRows > 0)
          : parsed.type === 'csv'
          ? (parsed.rowCount > 0)
          : true;
        if (!isValid) {
          console.warn('[DAO] Skipping zero-row file — not admitted to datasets:', parsed.name);
          continue;
        }
        newDatasets.push(parsed);
        const record = createDatasetRecord(file, parsed);
        const suggestedDomain = classifySuggestDomain(record);
        record.domain = suggestedDomain;
        const existingRegistry = loadDatasetRegistry();
        existingRegistry.push(record);
        saveDatasetRegistry(existingRegistry);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
    setDatasets(newDatasets);
    const summary = summarizeData(newDatasets, false);
    localStorage.setItem('dao-uploaded-summary', summary.slice(0, 800));
    checkDecisionHealth();
    return newDatasets;
  };

  // Handle files dropped/selected directly in chat
  const handleChatFiles = async (files) => {
    const parsedFiles = [];
    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        parsedFiles.push(parsed);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
    setChatFiles(prev => [...prev, ...parsedFiles]);
    // Also add to global datasets
    setDatasets(prev => [...prev, ...parsedFiles]);
  };

  // ═══════════ RISK RADAR ═══════════
  async function runRiskRadar() {
    setRiskRadarLoading(true);
    try {
      const decisions = loadJournal();
      const res = await fetch('/api/risk-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions, domainContext: JSON.stringify(domainConfig) })
      });
      const data = await res.json();
      setRiskRadar(data.risks || []);
    } catch(e) {
      console.error('Risk Radar error', e);
    }
    setRiskRadarLoading(false);
  }

  async function buildBoardPack() {
    const decisions = loadJournal();
    const closed = decisions.filter(d => d.lifecycleStatus === "Closed");
    const active = decisions.filter(d => d.lifecycleStatus === "Active" || d.lifecycleStatus === "Monitoring");
    const risks = riskRadar.slice(0, 5);
    const topPatterns = patterns.slice(0, 3);
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalDecisions: decisions.length,
        activeDecisions: active.length,
        closedDecisions: closed.length,
        openRisks: risks.length,
        patternsDetected: topPatterns.length
      },
      activeDecisions: active.map(d => ({
        id: d.id,
        statement: d.statement,
        tier: d.tier,
        lifecycleStatus: d.lifecycleStatus,
        confidenceScore: d.confidenceScore ?? 3,
        tags: d.tags || [],
        review_date: d.review_date
      })),
      risks,
      patterns: topPatterns
    };
  }

  async function handleGenerateBoardPack() {
    setBoardPackLoading(true);
    const pack = await buildBoardPack();
    setBoardPack(pack);
    setShowBoardPack(true);
    setBoardPackLoading(false);
  }

  function exportBoardPackJSON() {
    if (!boardPack) return;
    const blob = new Blob([JSON.stringify(boardPack, null, 2)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-pack-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function evaluateAllEscalationTriggers() {
    const decisions = loadJournal();
    const escalatable = decisions.filter(d =>
      d.tier === "1" && d.lifecycleStatus !== "Closed"
    );
    if (escalatable.length === 0) return;
    // Run risk radar automatically for Tier 1 active decisions
    await runRiskRadar();
  }

  // ═══════════ ENTERPRISE SCAN ═══════════
  const runScan = async (skipValidation = false) => {
    let findings = [];
    const registry = loadDatasetRegistry();
    if (!skipValidation && registry.length > 0) {
      const report = buildValidationReport(
        scanMode === 'revenue' ? 'revenue' : 'operational',
        registry
      );
      setScanValidation(report);
      setShowScanValidation(true);
      return;
    }
    if (datasets.length === 0) return;
    setScanning(true);
    navigate("/situations");
    try {
    const routedDatasets = registry.length > 0
      ? getIncludedDatasets(scanMode === 'revenue' ? 'revenue' : 'operational', registry)
          .map(record => datasets.find(d => d.name === record.name))
          .filter(Boolean)
      : datasets.slice(0, 3);
    const scanDatasets = routedDatasets.length > 0 ? routedDatasets : datasets.slice(0, 3);
    if (datasets.length > 3) console.warn("Scan capped at 3 sources. Upload fewer files for best results.");
    const dataSummary = summarizeData(scanDatasets, true);
    try {
      const activeDomainId = localStorage.getItem('dao-active-domain') || 'generic';
      const scanOverlay = getScanOverlay(activeDomainId);

      if (scanMode === "revenue") {
        setRevenueScanResults(null);
        const scanResp = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataSummary, scanType: 'revenue', domain: scanOverlay }),
        });
        if (!scanResp.ok) {
          const errData = await scanResp.json().catch(() => ({}));
          throw new Error(errData.error || `Scan error (${scanResp.status})`);
        }
        const scanData = await scanResp.json();
        if (scanData.error === 'scan_output_invalid') {
          throw new Error('Scan could not produce a valid structured output. Please retry.');
        }
        const result = transformScanJsonToText(scanData.text || '');
        setRevenueScanResults({ text: result, timestamp: new Date().toISOString(), industry: profile.industry });
        if (Array.isArray(scanData.patterns) && scanData.patterns.length > 0) {
          setPatterns(scanData.patterns.map(p => ({
            id: `${p.signal}-${p.value}`,
            label: `${p.signal}: ${p.value} (×${p.count})`,
            count: p.count,
            tags: [],
            avgConfidence: 0,
            lastSeen: new Date().toISOString(),
            evidence: p.evidence || '',
            trendDirection: p.trendDirection || '',
            action: p.action || '',
          })));
        }
        saveScanRecord(
          scanMode === 'revenue' ? 'revenue' : 'operational',
          scanDatasets,
          findings?.length || 0
        );
        fetchSituationAssessment(scanData.opportunities || [], 'revenue');
        fetchAndStoreAutoBrief(scanData.opportunities || [], 'revenue');
        loadCommandCentreStats();
      } else {
        setScanResults(null);
        const scanResp = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataSummary, scanType: 'operational', domain: scanOverlay }),
        });
        if (!scanResp.ok) {
          const errData = await scanResp.json().catch(() => ({}));
          throw new Error(errData.error || `Scan error (${scanResp.status})`);
        }
        const scanData = await scanResp.json();
        if (scanData.error === 'scan_output_invalid') {
          throw new Error('Scan could not produce a valid structured output. Please retry.');
        }
        const result = transformScanJsonToText(scanData.text || '');
        setScanResults({ text: result, timestamp: new Date().toISOString(), currency: scanData.currency || null });
        if (Array.isArray(scanData.patterns) && scanData.patterns.length > 0) {
          setPatterns(scanData.patterns.map(p => ({
            id: `${p.signal}-${p.value}`,
            label: `${p.signal}: ${p.value} (×${p.count})`,
            count: p.count,
            tags: [],
            avgConfidence: 0,
            lastSeen: new Date().toISOString(),
            evidence: p.evidence || '',
            trendDirection: p.trendDirection || '',
            action: p.action || '',
          })));
        }
        saveScanRecord(
          scanMode === 'revenue' ? 'revenue' : 'operational',
          scanDatasets,
          findings?.length || 0
        );
        fetchSituationAssessment(scanData.findings || [], 'operational');
        fetchAndStoreAutoBrief(scanData.findings || [], 'operational');
        loadCommandCentreStats();
      }
    } catch (e) {
      const isRateLimit = e.message.toLowerCase().includes("rate");
      const errText = isRateLimit
        ? "Scan rate limited. Please wait 30 seconds and click Re-scan."
        : `Error running scan: ${e.message}`;
      const errObj = { text: errText, timestamp: new Date().toISOString(), error: true };
      scanMode === "revenue" ? setRevenueScanResults(errObj) : setScanResults(errObj);
    }
    } catch (e) {
      const errObj = { text: `Error preparing scan: ${e.message}`, timestamp: new Date().toISOString(), error: true };
      scanMode === "revenue" ? setRevenueScanResults(errObj) : setScanResults(errObj);
    } finally {
      setScanning(false);
    }
    await evaluateAllEscalationTriggers();
  };

  async function proceedWithScan() {
    setShowScanValidation(false);
    setScanValidation(null);
    await runScan(true);
  }

  function saveScanRecord(type, datasetsUsed, findingCount) {
    const key = 'dao-scan-history';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const record = {
      id: Date.now().toString(),
      type,
      date: new Date().toISOString(),
      datasetsUsed: datasetsUsed.map(d => d.name || d),
      findingCount,
    };
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  }

  async function fetchSituationAssessment(findings, scanType) {
    if (!findings || findings.length === 0) return;
    setLoadingSituation(true);
    try {
      const res = await fetch('/api/situation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings,
          scanType,
          domainContext: JSON.stringify(domainConfig)
        })
      });
      const data = await res.json();
      if (data.success) setSituationAssessment(data.assessment);
    } catch (err) {
      console.error('Situation assessment error:', err);
    } finally {
      setLoadingSituation(false);
    }
  }

  async function fetchAndStoreAutoBrief(findings, scanType) {
    if (!findings || findings.length === 0) return;
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings,
          scanType,
          domainContext: JSON.stringify(domainConfig),
          uploadedSummary: localStorage.getItem('dao-uploaded-summary') || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setAutoBrief(data.brief);
        localStorage.setItem('dao-auto-brief', JSON.stringify(data.brief));
      }
    } catch (err) {
      console.error('Auto brief generation error:', err);
    }
  }

  function loadCommandCentreStats() {
    try {
      const history = JSON.parse(
        localStorage.getItem('dao-scan-history') || '[]'
      );
      if (history.length > 0) {
        setCommandCentreStats({
          lastScanTime: history[0].date,
          totalScans: history.length,
          lastScanType: history[0].type
        });
      }
    } catch {}
  }

  function updateScanSchedule(type, frequency) {
    const updated = { ...scanSchedule, [type]: frequency };
    setScanSchedule(updated);
    localStorage.setItem('dao-scan-schedule', JSON.stringify(updated));
  }

  // ═══════════ CHAT ═══════════
  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicState("error"); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setMicState("listening");
    r.onend = () => setMicState("idle");
    r.onerror = () => setMicState("error");
    r.onresult = (e) => {
      setChatInput(prev => prev + e.results[0][0].transcript);
      setMicState("idle");
    };
    r.start();
  };

  const generateMsgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const sendMessage = async () => {
    if (!chatInput.trim() && chatFiles.length === 0) return;
    if (streaming) return;

    const userMsg = chatInput.trim();
    setChatInput("");

    // Build message content including any attached files
    let fullContent = userMsg;
    const attachedFileNames = chatFiles.map(f => f.name);

    if (chatFiles.length > 0) {
      const fileSummary = summarizeData(chatFiles);
      fullContent = userMsg
        ? `${userMsg}\n\n[ATTACHED FILES]\n${fileSummary}`
        : `Please analyse the following uploaded data:\n\n[ATTACHED FILES]\n${fileSummary}`;
    }

    // Show user message with file attachments
    const displayContent = attachedFileNames.length > 0
      ? `${userMsg || "Analyse these files"}${attachedFileNames.map(n => `\n📎 ${n}`).join("")}`
      : userMsg;

    const newMsgs = [...chatMsgs, { role: "user", content: displayContent, msgId: generateMsgId() }];
    setChatMsgs(newMsgs);
    setChatFiles([]); // Clear attached files
    setStreaming(true);

    try {
      const activeFindings = parsedFindings.filter(f => !resolvedFindings.includes(f.id));
      const totalExposureAmount = activeFindings.reduce((s, f) => s + (f.maxAmount || 0), 0);
      const totalExposureStr = totalExposureAmount > 0
        ? `${activeFindings.find(f => f.currencySymbol)?.currencySymbol || ''}${totalExposureAmount.toLocaleString()}`
        : null;
      const chiefContext = parsedFindings.length > 0 ? {
        findings: parsedFindings.slice(0, 3).map(f => ({
          title: f.pattern || '',
          severity: f.tier || '',
          impact: f.impact || '',
          evidence: f.evidence ? (f.evidence.length > 250 ? f.evidence.slice(0, 250).replace(/\S*$/, '').trim() + '...' : f.evidence) : '',
          fix: f.fix ? (f.fix.length > 300 ? f.fix.slice(0, 300).replace(/\S*$/, '').trim() + '...' : f.fix) : ''
        })),
        totalExposure: totalExposureStr,
        scanType: scanMode,
        domain: activeDomain,
        scannedAt: scanResults?.timestamp || revenueScanResults?.timestamp || null,
        dataSummary: localStorage.getItem('dao-uploaded-summary') || ''
      } : null;

      const chiefRes = await fetch('/api/chief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullContent, chiefContext })
      });
      const chiefData = await chiefRes.json();
      const chiefRaw = chiefData.text || 'I was unable to generate a response. Please try again.';
      const chiefConfMatch = chiefRaw.match(/\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b/i);
      const chiefConf = chiefConfMatch ? chiefConfMatch[1].toUpperCase() : null;
      const chiefText = chiefRaw.replace(/[-–—]*\s*\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b[^\n]*/gi, '').trim();
      setChatMsgs(prev => [...prev, { role: 'assistant', content: chiefText, confidence: chiefConf, msgId: generateMsgId() }]);
      setStreaming(false);
      return;
    } catch (e) {
      setChatMsgs(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", confidence: null, failed: true, retryQuery: userMsg, msgId: generateMsgId() }]);
    }
    setStreaming(false);
  };

  const retryChiefMessage = async (targetMsgId, retryQuery) => {
    if (streaming) return;
    const snapshot = chatMsgs.filter(m => m.msgId !== targetMsgId);
    setStreaming(true);
    const activeFindings = parsedFindings.filter(f => !resolvedFindings.includes(f.id));
    const totalExposureAmount = activeFindings.reduce((s, f) => s + (f.maxAmount || 0), 0);
    const totalExposureStr = totalExposureAmount > 0
      ? `${activeFindings.find(f => f.currencySymbol)?.currencySymbol || ''}${totalExposureAmount.toLocaleString()}`
      : null;
    const chiefContext = parsedFindings.length > 0 ? {
      findings: parsedFindings.slice(0, 3).map(f => ({
        title: f.pattern || '',
        severity: f.tier || '',
        impact: f.impact || '',
        evidence: f.evidence ? (f.evidence.length > 250 ? f.evidence.slice(0, 250).replace(/\S*$/, '').trim() + '...' : f.evidence) : '',
        fix: f.fix ? (f.fix.length > 300 ? f.fix.slice(0, 300).replace(/\S*$/, '').trim() + '...' : f.fix) : ''
      })),
      totalExposure: totalExposureStr,
      scanType: scanMode,
      domain: activeDomain,
      scannedAt: scanResults?.timestamp || revenueScanResults?.timestamp || null,
      dataSummary: localStorage.getItem('dao-uploaded-summary') || ''
    } : null;
    try {
      const chiefRes = await fetch('/api/chief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: retryQuery, chiefContext })
      });
      const chiefData = await chiefRes.json();
      const chiefRaw = chiefData.text || 'I was unable to generate a response. Please try again.';
      const chiefConfMatch = chiefRaw.match(/\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b/i);
      const chiefConf = chiefConfMatch ? chiefConfMatch[1].toUpperCase() : null;
      const chiefText = chiefRaw.replace(/[-—–]*\s*\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b[^\n]*/gi, '').trim();
      setChatMsgs([...snapshot, { role: 'assistant', content: chiefText, confidence: chiefConf, msgId: generateMsgId() }]);
    } catch (e) {
      setChatMsgs([...snapshot, { role: 'assistant', content: 'Something went wrong. Please try again.', confidence: null, failed: true, retryQuery, msgId: generateMsgId() }]);
    }
    setStreaming(false);
  };

  // ═══════════ AUTO-LOG DECISION DETECTION ═══════════
  const detectDecisionInMessage = (content) => {
    const decisionPatterns = [
      /I recommend|recommend that you|my recommendation/i,
      /you should decide|decision is|suggest deciding/i,
      /approved|approving|approve/i,
      /rejected|rejecting|reject/i,
      /postponed|postponing|postpone/i,
      /proceeding with|go with|moving forward with/i,
      /tier [123]|severity/i,
      /FIX:|RECOMMENDATION:|DECISION:/i
    ];
    return decisionPatterns.some(pattern => pattern.test(content));
  };

  const extractDecisionFromConversation = (msgIndex) => {
    const aiMsg = chatMsgs[msgIndex];
    const userMsg = msgIndex > 0 ? chatMsgs[msgIndex - 1] : null;

    // Try to extract decision statement from AI response
    let statement = "";
    const recommendMatch = aiMsg.content.match(/(?:recommend|suggest|decision is|approved?|rejected?)[:\s]+([^.\n]{20,200})/i);
    if (recommendMatch) {
      statement = recommendMatch[1].trim();
    } else {
      // Fallback: use first substantial sentence
      const sentences = aiMsg.content.split(/[.!?]\s+/);
      statement = sentences.find(s => s.length > 20 && s.length < 200) || "";
    }

    // Extract evidence from context
    const evidenceMatch = aiMsg.content.match(/(?:evidence|data shows?|based on)[:\s]+([^.\n]{20,300})/i);
    const evidence = evidenceMatch ? evidenceMatch[1].trim() : "";

    // Extract assumptions
    const assumptionMatch = aiMsg.content.match(/(?:assum(?:e|ing|ption))[:\s]+([^.\n]{20,300})/i);
    const assumptions = assumptionMatch ? assumptionMatch[1].trim() : "";

    // Detect tier from severity language
    let tier = "2";
    if (/critical|urgent|tier 3|high severity/i.test(aiMsg.content)) tier = "3";
    if (/low impact|minor|tier 1/i.test(aiMsg.content)) tier = "1";

    // Detect type from context
    let type = "technical";
    if (/people|team|hiring|cultural|leadership/i.test(aiMsg.content)) type = "human";
    if (/political|stakeholder|board|regulatory/i.test(aiMsg.content)) type = "political";
    if (/culture|values|norms|behavior/i.test(aiMsg.content)) type = "cultural";

    // Detect confidence
    let confidence = "moderate";
    if (/high confidence|very confident|certain/i.test(aiMsg.content)) confidence = "high";
    if (/low confidence|uncertain|unclear/i.test(aiMsg.content)) confidence = "low";

    return {
      statement: statement.slice(0, 200) || "Decision from conversation",
      tier,
      type,
      evidence: evidence.slice(0, 300),
      assumptions: assumptions.slice(0, 300),
      confidence,
      expected: "",
      reviewDays: 30
    };
  };

  const handleLogDecisionFromChat = (msgIndex) => {
    const extracted = extractDecisionFromConversation(msgIndex);
    setJf(extracted);
    setShowJournalForm(true);
    navigate("/journal");
  };

  // ═══════════ JOURNAL ═══════════
  const addJournalEntry = async () => {
    const formData = { tier: parseInt(jf.tier), owner: jf.owner, review_date: jf.review_date, expected_outcome: jf.expected };
    const { valid, errors } = validateDecision(formData);
    if (!valid) { setDalErrors(errors); return; }
    setDalErrors([]);
    const rawEntry = {
      id: `DEC-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString().split("T")[0],
      statement: jf.statement,
      tier: jf.tier,
      type: jf.type,
      evidence: jf.evidence,
      assumptions: jf.assumptions,
      confidence: jf.confidence,
      expected: jf.expected,
      owner: jf.owner,
      review_date: jf.review_date,
      decidedBy: profile.name,
      status: "Confirmed",
      actualOutcome: "",
      learning: "",
      rationale: "",
      context: "",
      challenge_flags: [],
      confidenceScore: jf.confidenceScore ?? 3,
      tags: (jf.tagsRaw || "").split(",").map(t => t.trim()).filter(Boolean),
      lifecycleStatus: jf.lifecycleStatus || "Active"
    };

    // Tier 2+ → route through Challenge Check modal
    if (parseInt(jf.tier) >= 2) {
      setChallengePending(rawEntry);
      setChallengeOpen(true);
      return;
    }

    // Tier 1 → save immediately
    const entry = upgradedDecision(rawEntry);
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    const refreshedPatterns = detectPatterns(updated);
    setPatterns(refreshedPatterns);
    savePatterns(refreshedPatterns);
    logAudit(profile.name, entry.id, 'CREATE', 1);
    setShowJournalForm(false);
    setJf({ statement: "", tier: "1", type: "technical", evidence: "", assumptions: "", confidence: "moderate", expected: "", owner: "", review_date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(), reviewDays: 30, confidenceScore: 3, tagsRaw: "", lifecycleStatus: "Active" });

    // Theory of Mind: trigger Decision Profile after 10 entries
    if (updated.length >= 10 && !profileLoading) {
      setProfileLoading(true);
      try {
        const journalText = updated.slice(0, 20).map(j =>
          `[${j.date}] ${j.statement} | Type: ${j.type} | Tier: ${j.tier} | Confidence: ${j.confidence} | Assumptions: ${j.assumptions || "none logged"}`
        ).join("\n");
        const profileResult = await callClaudeSync(
          `You are analysing a CEO's decision-making patterns to build their Decision Profile. Be direct, specific, and evidence-based. Only state what the data shows — do not fill gaps with generalities.`,
          [{ role: "user", content: `Analyse these ${updated.length} decisions made by ${profile.name} at ${profile.org}:\n\n${journalText}\n\nIdentify:\n1. DOMINANT DECISION TYPE (technical/human/political/cultural) and what this reveals\n2. CONFIDENCE PATTERN (do they over- or under-index confidence vs tier?)\n3. ASSUMPTION RISK (are assumptions data-backed or inferred?)\n4. BLIND SPOT (what decision type is conspicuously absent or under-documented?)\n5. ONE COACHING INSIGHT (the single most important pattern to be aware of)\n\nBe blunt. This is a private profile for the CEO's own growth.` }]
        );
        const profile_data = { text: profileResult, generatedAt: new Date().toISOString(), basedOn: updated.length };
        setDecisionProfile(profile_data);
        store.set("dao-decision-profile", profile_data);
      } catch (e) {
        console.error("Decision Profile generation failed:", e);
      }
      setProfileLoading(false);
    }
  };

  const confirmDecision = async () => {
    setRationaleLoading(true);
    let rationale = "", context = "", confidence = "";
    try {
      const res = await fetchWithRetry("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `Return JSON only: {"rationale":"2-3 sentence rationale","context":"1 line context","confidence":"High|Medium|Low"}`,
          messages: [{ role: "user", content:
            `Decision: ${challengePending?.statement}\nTier: ${challengePending?.tier}\nExpected: ${challengePending?.expected_outcome}` }],
          stream: false
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      rationale = parsed.rationale;
      context = parsed.context;
      confidence = parsed.confidence;
    } catch (e) { /* fail silently — never block save */ }

    const entry = upgradedDecision({
      ...challengePending,
      rationale,
      context,
      confidence,
      challenge_flags: checkedFlags
    });
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    const refreshedPatterns = detectPatterns(updated);
    setPatterns(refreshedPatterns);
    savePatterns(refreshedPatterns);
    logAudit(profile?.name, entry.id, "CONFIRM", entry.version);
    setRationaleLoading(false);
    setChallengeOpen(false);
    setChallengePending(null);
    setCheckedFlags([]);
    setShowJournalForm(false);
  };

  const submitReview = () => {
    const reviewEntry = {
      id: `REV-${Date.now().toString(36).toUpperCase()}`,
      reviewed_at: new Date().toISOString(),
      verdict: reviewForm.verdict,
      actual_outcome: reviewForm.actual_outcome,
      lesson: reviewForm.lesson,
      variance: reviewForm.variance,
      reviewNotes: reviewForm.reviewNotes || "",
      version: 1,
      copilotProposal: copilotVariance.variance || null,
      copilotConfidence: copilotVariance.confidence || null,
      humanFinalChoice: reviewForm.variance,
      overrideOccurred: humanOverrode,
    };
    const updated = journal.map(e => {
      if (e.id !== reviewModal.id) return e;
      const reviews = [...(e.reviews ?? []), reviewEntry];
      const newLifecycleStatus = reviewForm.updateStatus || "Monitoring";
      return { ...e, reviews, status: "Reviewed", lifecycleStatus: newLifecycleStatus, review_date: new Date().toISOString().split('T')[0] };
    });
    setJournal(updated);
    saveJournal(updated);
    setJournal(loadJournal());
    const refreshedPatterns = detectPatterns(updated);
    setPatterns(refreshedPatterns);
    savePatterns(refreshedPatterns);
    logAudit(profile.name, reviewModal.id, 'REVIEW', reviewModal.version ?? 1);
    setReviewModal(null);
    setCopilotVariance({variance:null,confidence:null,reasoning:null,loading:false});
    setReviewForm({ verdict: "On Track", actual_outcome: "", lesson: "", variance: "", reviewNotes: "", updateStatus: "" });
    setHumanOverrode(false);
  };

  function stripMd(str) {
    if (!str) return "";
    return str
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s*/g, "");
  }

  const generateBoardReport = async () => {
    try {
      // Task 3.7 — re-read all data from storage at PDF generation time (Flag 59)
      const liveJournal = loadJournal();
      const liveScanResult = store.get("dao-scan");
      const liveCurrency = liveScanResult?.currency || 'RM';
      const liveParsedFindings = liveScanResult?.text ? parseFindings(liveScanResult.text) : [];
      const liveRevenueScanResult = store.get("dao-revenue-scan");
      const liveRevenueFindings = liveRevenueScanResult?.text ? parseRevenueFindings(liveRevenueScanResult.text) : [];
      const liveResolvedFindings = store.get("dao-resolved-findings") || [];
      const liveChangeProjects = store.get("dao-change-projects") || [];
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = 210;
      const margin = 20;
      const usable = pw - margin * 2;
      let y = 20;
      const line = (text, size, bold, color) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...(color || [226, 232, 240]));
        if (Array.isArray(text)) {
          text.forEach(t => { doc.text(t, margin, y); y += size * 0.45; });
        } else {
          doc.text(String(text), margin, y); y += size * 0.45;
        }
      };
      const rule = (c) => { doc.setDrawColor(...(c || [30, 58, 95])); doc.line(margin, y, pw - margin, y); y += 5; };
      const gap = (n) => { y += n || 4; };
      // Background
      doc.setFillColor(11, 17, 32);
      doc.rect(0, 0, 210, 297, "F");
      // Header
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, 210, 28, "F");
      line("DECISION ACCOUNTABILITY OS", 10, true, [14, 165, 233]);
      gap(2);
      line(`${profile.org}  |  ${profile.industry}  |  ${profile.region?.toUpperCase()}`, 8, false, [148, 163, 184]);
      gap(2);
      line(`Board Report  —  Generated ${new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })}  —  ${profile.name}`, 8, false, [148, 163, 184]);
      const generatedAt = new Date().toLocaleString("en-MY", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      line(`Generated at:  ${generatedAt}`, 8, false, [148, 163, 184]);
      gap(6);
      rule([14, 165, 233]);
      // Section 1: Command Centre
      line("1.  COMMAND CENTRE SUMMARY", 11, true, [14, 165, 233]);
      gap(4);
      const activeF = liveParsedFindings.filter(f => !liveResolvedFindings.includes(f.id));
      const totalExp = activeF.reduce((s, f) => s + f.maxAmount, 0);
      const overdue = liveJournal.filter(j => new Date(j.review_date) < new Date() && j.status !== "resolved").length;
      line(`Active Findings: ${activeF.length}   |   Resolved: ${liveResolvedFindings.length}   |   Financial Exposure: ${liveCurrency} ${totalExp.toLocaleString()}`, 9, false, [226, 232, 240]);
      gap(2);
      line(`Decisions Logged: ${liveJournal.length}   |   Overdue Reviews: ${overdue}   |   Revenue Opportunities: ${liveRevenueFindings.length}`, 9, false, [226, 232, 240]);
      gap(6);
      rule();
      // Section 2: Top Operational Findings
      if (liveParsedFindings.length > 0) {
        line("2.  TOP OPERATIONAL FINDINGS", 11, true, [14, 165, 233]);
        gap(4);
        liveParsedFindings.slice(0, 5).forEach((f, i) => {
          line(`${i + 1}.  [TIER ${f.tier}]  ${stripMd(f.pattern)}`, 9, false, [226, 232, 240]);
          gap(1);
          if (f.maxAmount > 0) { line(`     Exposure: ${liveCurrency} ${f.maxAmount.toLocaleString()}  |  Daily cost: ${liveCurrency} ${f.dailyCost.toLocaleString()}  |  ${liveResolvedFindings.includes(f.id) ? "RESOLVED" : "OPEN"}`, 8, false, [148, 163, 184]); gap(1); }
          if (f.fix) { line(`     Action: ${stripMd(f.fix).substring(0, 90)}`, 8, false, [148, 163, 184]); }
          gap(3);
          if (f.evidence && f.evidence.trim().length > 0) { const evLines = doc.splitTextToSize(f.evidence, usable - 10); line(evLines, 8, false, [148, 163, 184]); gap(1); }
        });
        rule();
      }
      // Section 3: Revenue Intelligence
      if (liveRevenueFindings.length > 0) {
        line("3.  REVENUE OPPORTUNITIES", 11, true, [14, 165, 233]);
        gap(4);
        const totalRevPot = liveRevenueFindings.reduce((s, o) => s + o.maxAmount, 0);
        line(`Total Potential: RM ${totalRevPot.toLocaleString()}  |  Quick Wins: ${liveRevenueFindings.filter(o => o.isQuickWin).length}`, 9, false, [226, 232, 240]);
        gap(3);
        liveRevenueFindings.forEach((o, i) => {
          line(`${i + 1}.  [${o.category}]  ${stripMd(o.pattern)}`, 9, false, [226, 232, 240]);
          gap(1);
          if (o.maxAmount > 0) { line(`     Potential: RM ${o.maxAmount.toLocaleString()}  |  ${stripMd(o.timeframe?.split("(")[0].trim())}  |  ${o.isQuickWin ? "QUICK WIN" : ""}`, 8, false, [148, 163, 184]); gap(1); }
          if (o.action) { line(`     Action: ${stripMd(o.action).substring(0, 90)}`, 8, false, [148, 163, 184]); }
          gap(3);
        });
        rule();
      }
      // Page 2 if needed
      if (y > 220) { doc.addPage(); doc.setFillColor(11, 17, 32); doc.rect(0, 0, 210, 297, "F"); y = 20; }
      // Section 4: Decisions
      if (liveJournal.length > 0) {
        line("4.  RECENT DECISIONS", 11, true, [14, 165, 233]);
        gap(4);
        liveJournal.slice(0, 5).forEach((j, i) => {
          line(`${i + 1}.  [TIER ${j.tier}  |  ${j.type}]  ${stripMd(j.statement)}`, 9, false, [226, 232, 240]);
          gap(1);
          line(`     Date: ${j.date}  |  Status: ${j.status}  |  Review by: ${j.review_date}`, 8, false, [148, 163, 184]);
          gap(3);
        });
        rule();
      }
      // Section 5: Change Tracker
      if (liveChangeProjects.length > 0) {
        line("5.  IMPLEMENTATION PROGRESS", 11, true, [14, 165, 233]);
        gap(4);
        liveChangeProjects.forEach(p => {
          const pct = Math.round(p.workstreams.reduce((s, w) => s + w.pct, 0) / p.workstreams.length);
          const atRisk = p.workstreams.filter(w => w.status === "At Risk").length;
          line(`${stripMd(p.name)}  —  ${pct}% complete${atRisk > 0 ? `  |  ${atRisk} workstream(s) AT RISK` : ""}`, 10, true, [226, 232, 240]);
          gap(2);
          p.workstreams.forEach(w => {
            line(`     ${w.name}:  ${w.status}  (${w.pct}%)${w.note ? "  — " + stripMd(w.note).substring(0, 50) : ""}`, 8, false, [148, 163, 184]);
            gap(1);
          });
          gap(4);
        });
        rule();
      }
      // Footer
      gap(4);
      line("Confidential  |  Generated by Decision Accountability OS  |  Powered by 30GENS", 7, false, [148, 163, 184]);
      doc.save(`${profile.org}-Board-Report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF generation failed: " + e.message + "\n\nTry running npm install in your project folder.");
    }
  };

  // ═══════════ RESET ═══════════
  const resetAll = () => {
    store.del("dao-profile");
    store.del("dao-journal");
    store.del("dao-datasets-meta");
    store.del("dao-scan");
    store.del("dao-chat");
    setProfile(null);
    setJournal([]);
    setDatasets([]);
    setScanResults(null);
    setChatMsgs([]);
    setOnboardStep(0);
    setOb({ name: "", org: "", industry: "", region: "asean", style: "" });
    store.del("dao-resolved-findings");
    store.del("dao-revenue-scan");
    store.del("dao-change-projects");
    setResolvedFindings([]);
    setParsedFindings([]);
    setRevenueFindings([]);
    setRevenueScanResults(null);
    setScanMode("operational");
    setChangeProjects([]);
    setShowChangeForm(false);
  };

  async function preloadVarianceForDueDecisions() {
    try {
      const stored = localStorage.getItem('dao-journal');
      const allDecisions = stored ? JSON.parse(stored) : [];
      const today = new Date();
      const due = allDecisions
        .filter(d => d.status === 'Confirmed' && d.review_date && new Date(d.review_date) <= today)
        .slice(0, 3);
      if (due.length === 0) return;
      const newReadyIds = [];
      for (const decision of due) {
        try {
          const res = await fetch('/api/variance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              decisionTitle: decision.title || '',
              context: decision.context || '',
              rationale: decision.rationale || '',
              tier: decision.tier || '',
              reviewNotes: decision.reviewNotes || '',
              uploadedDataSummary: '',
              activeDomain: activeDomainId || 'generic'
            })
          });
          if (res.ok) {
            const data = await res.json();
            setCopilotReadyIds(prev => [...prev, decision.id]);
            newReadyIds.push(decision.id);
          }
        } catch (err) {
          console.warn('[DAO] Variance preload failed for', decision.id, err);
        }
      }
      setCopilotReadyIds(prev => [...new Set([...prev, ...newReadyIds])]);
    } catch (err) {
      console.warn('[DAO] preloadVarianceForDueDecisions error:', err);
    }
  };

  async function checkDecisionHealth() {
    try {
      const stored = localStorage.getItem('dao-journal');
      const allDecisions = stored ? JSON.parse(stored) : [];
      const active = allDecisions.filter(d =>
        d.status === 'Confirmed' || d.status === 'Draft'
      );
      if (active.length === 0) {
        setDecisionHealth({ results: [] });
        return;
      }
      const truncated = active.map(d => ({
        ...d,
        context: (d.context || '').slice(0, 200),
        rationale: (d.rationale || '').slice(0, 200)
      }));
      const stored2 = localStorage.getItem('dao-uploaded-summary');
      const dataSummary = stored2 ? stored2.slice(0, 800) : '';
      const activeDomainKey = localStorage.getItem('dao-active-domain') || 'generic';
      const res = await fetch('/api/decision-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: truncated,
          dataSummary,
          activeDomain: activeDomainKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDecisionHealth(data);
      }
    } catch (err) {
      console.warn('[DAO] checkDecisionHealth error:', err);
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
    { id: "chat", label: "Chat", icon: ChatIcon },
    { id: "scan", label: "Scan", icon: ScanIcon },
    { id: "journal", label: "Decision Ledger", icon: BookIcon, badge: journal.length || null },
    { id: "track", label: "Track", icon: ClipboardIcon, badge: changeProjects.length || null },
    { id: "data", label: "Data", icon: FileIcon, badge: datasets.length || null },
  ];

  const navRouteMap = {
    dashboard: "/dashboard",
    chat: "/chat",
    scan: "/situations",
    journal: "/journal",
    track: "/track",
    data: "/connect"
  };

  // ═══════════ MAIN LAYOUT ═══════════
  return (
    <div style={{ background: BG_DARK, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: TEXT, display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header style={{ background: BG_CARD, borderBottom: `1px solid ${BORDER}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: "none", border: "none", color: TEXT, cursor: "pointer", padding: 4, display: "flex" }}>
            <MenuIcon size={22}/>
          </button>
          <div>
            <div style={{ fontSize: 13, letterSpacing: 3, color: ACCENT, fontWeight: 600 }}>30GENS</div>
            <div style={{ fontSize: 11, color: TEXT_DIM }}>
              {profile.org} • {profile.industry}
              {localStorage.getItem('dao-active-domain') === 'water' && (
                <span style={{ color: "#5EEAD4", marginLeft: 5, fontWeight: 400 }}>• Domain Active</span>
              )}
            </div>
          </div>
          <span style={{ background: '#e6f4ff', color: '#1677ff', borderRadius: 12,
            padding: '2px 10px', fontSize: 12, marginLeft: 10, fontWeight: 500 }}>
            {domainConfig.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* API Status Badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 12,
            background: apiStatus === "live" ? `${GREEN}20` : `${AMBER}20`,
            color: apiStatus === "live" ? GREEN : AMBER,
            letterSpacing: 0.5
          }}>
            {apiStatus === "live" ? "LIVE" : "DEMO"}
          </span>
          {datasets.length > 0 && (
            <button onClick={runScan} disabled={scanning} style={{ ...btnSmall, background: scanning ? BG_SURFACE : `${GREEN}20`, color: scanning ? TEXT_DIM : GREEN, border: `1px solid ${scanning ? BORDER : GREEN}40` }}>
              {scanning ? "Scanning..." : "Scan"}
            </button>
          )}
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: ACCENT }}>
            {profile.name.charAt(0)}
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* SIDEBAR */}
        {sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}/>}
        <aside style={{
          position: "fixed", left: sideOpen ? 0 : -280, top: 0, bottom: 0, width: 280, background: BG_CARD,
          borderRight: `1px solid ${BORDER}`, zIndex: 45, transition: "left 0.3s ease", padding: "80px 16px 16px",
          display: "flex", flexDirection: "column"
        }}>
          <button onClick={() => setSideOpen(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: TEXT_DIM, cursor: "pointer" }}>
            <XIcon size={20}/>
          </button>
          <div style={{ flex: 1 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => { navigate(navRouteMap[item.id] || ("/" + item.id)); setSideOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px",
                background: location.pathname === navRouteMap[item.id] ? `${ACCENT}15` : "transparent",
                border: `1px solid ${location.pathname === navRouteMap[item.id] ? `${ACCENT}40` : "transparent"}`,
                borderRadius: 10, cursor: "pointer", color: location.pathname === navRouteMap[item.id] ? ACCENT : TEXT_DIM,
                marginBottom: 4, transition: "all 0.2s", fontSize: 14, fontWeight: 500
              }}>
                <item.icon size={18} color={location.pathname === navRouteMap[item.id] ? ACCENT : TEXT_DIM}/>
                {item.label}
                {item.badge && <span style={{ marginLeft: "auto", background: `${ACCENT}20`, color: ACCENT, borderRadius: 10, padding: "2px 8px", fontSize: 12 }}>{item.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 4 }}>
              Mode: {profile.style === "direct" ? "Direct" : profile.style === "solution" ? "Solution-First" : "Balanced"}
            </div>
            <div style={{ fontSize: 12, color: apiStatus === "live" ? GREEN : AMBER, marginBottom: 8 }}>
              AI: {apiStatus === "live" ? "Live (Claude)" : "Demo Mode"}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 6, fontWeight: 500 }}>Active Domain</div>
              <select
                value={activeDomain}
                onChange={e => setActiveDomain(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, outline: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
              >
                {Object.values(DOMAINS).map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {getDomain(activeDomain).focusAreas.map(area => (
                  <span key={area} style={{ background: `${ACCENT}15`, color: ACCENT, borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>{area}</span>
                ))}
              </div>
            </div>
            <button onClick={resetAll} style={{ fontSize: 12, color: RED, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset Everything</button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ShellFrame domainLabel={domainConfig.label} situationTitle="">
          <Routes>
            <Route path="/" element={<WelcomeScreen situationCount={situationCount} singleSituationId={singleSituationId} />} />
            <Route path="/board" element={<Navigate to="/chat" replace />} />

          {/* ═══════ CHAT VIEW ═══════ */}
            <Route path="/chat" element={(
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Chat sub-header: Chief Status + Clear History */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 16px", borderBottom: `1px solid ${BORDER}20` }}>
                {/* Chief Status Indicator */}
                <div title={apiStatus === 'live' ? "Chief Ready: the AI assistant is connected and ready to support decision reviews." : undefined} style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: apiStatus === 'live' ? GREEN : apiStatus === 'demo' ? AMBER : TEXT_DIM }}>
                  <span style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    marginRight: 6,
                    background: apiStatus === 'live' ? GREEN : apiStatus === 'demo' ? AMBER : "#6B7280"
                  }}/>
                  {apiStatus === 'live' ? 'Chief Ready' : apiStatus === 'demo' ? 'Demo Mode' : 'Checking...'}
                </div>
                {/* Clear History button / inline confirm */}
                {chatMsgs.length > 0 && !confirmClearHistory && (
                  <button
                    onClick={() => setConfirmClearHistory(true)}
                    style={{
                      fontSize: 11,
                      color: TEXT_DIM,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontFamily: "'DM Sans', sans-serif",
                      transition: "color 0.15s"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = RED; }}
                    onMouseLeave={e => { e.currentTarget.style.color = TEXT_DIM; }}
                    title="Clear chat history"
                  >
                    🗑 Clear History
                  </button>
                )}
                {confirmClearHistory && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'DM Sans', sans-serif" }}>Clear all history?</span>
                    <button
                      onClick={() => {
                        setChatMsgs([]);
                        localStorage.removeItem('dao-chief-history');
                        store.del('dao-chat');
                        setConfirmClearHistory(false);
                      }}
                      style={{
                        fontSize: 11,
                        color: RED,
                        background: "none",
                        border: `1px solid ${RED}60`,
                        cursor: "pointer",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontFamily: "'DM Sans', sans-serif"
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmClearHistory(false)}
                      style={{
                        fontSize: 11,
                        color: TEXT_DIM,
                        background: "none",
                        border: `1px solid ${BORDER}`,
                        cursor: "pointer",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontFamily: "'DM Sans', sans-serif"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>
                {chatMsgs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>&#127919;</div>
                    <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT, margin: "0 0 8px" }}>Your Command Centre is Ready</h2>
                    <p style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
                      {datasets.length > 0
                        ? `${datasets.length} data source(s) connected. Ask me anything or run an Enterprise Scan.`
                        : "Drop a file below or type a question to get started."}
                    </p>
                    {apiStatus === "demo" && (
                      <p style={{ fontSize: 12, color: AMBER, marginTop: 12, maxWidth: 400, margin: "12px auto 0" }}>
                        Running in demo mode. Add your Anthropic API key to .env and restart for live AI.
                      </p>
                    )}
                  </div>
                )}
                {chatMsgs.map((msg, i) => (
                  <div key={msg.msgId} style={{
                    display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 16, maxWidth: "100%"
                  }}>
                    <div style={{
                      maxWidth: msg.role === "user" ? "80%" : "90%",
                      background: msg.role === "user" ? ACCENT_DIM : BG_CARD,
                      border: msg.role === "user" ? "none" : `1px solid ${BORDER}`,
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      padding: "12px 16px", fontSize: 14, lineHeight: 1.6,
                      whiteSpace: "pre-wrap", wordBreak: "break-word"
                    }}>
                      {msg.role === 'assistant'
                        ? <>
                            <span dangerouslySetInnerHTML={{ __html:
                                (msg.content || '')
                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  .replace(/\n/g, '<br/>')
                              }} />
                            {msg.confidence && (
                              <span style={{
                                display: 'inline-block',
                                marginTop: 8,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 10,
                                letterSpacing: 0.5,
                                background: msg.confidence === 'HIGH' ? '#10B98120' : msg.confidence === 'MODERATE' ? '#F59E0B20' : '#94A3B820',
                                color: msg.confidence === 'HIGH' ? '#10B981' : msg.confidence === 'MODERATE' ? '#F59E0B' : '#94A3B8',
                                border: `1px solid ${msg.confidence === 'HIGH' ? '#10B98140' : msg.confidence === 'MODERATE' ? '#F59E0B40' : '#94A3B840'}`
                              }}>
                                {msg.confidence} confidence
                              </span>
                            )}
                            {msg.failed === true && (
                              <div style={{ marginTop: 8 }}>
                                <button
                                  onClick={() => retryChiefMessage(msg.msgId, msg.retryQuery)}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: '#F59E0B20',
                                    border: '1px solid #F59E0B40',
                                    borderRadius: 8,
                                    color: '#F59E0B',
                                    cursor: 'pointer',
                                    fontFamily: "'DM Sans', sans-serif"
                                  }}
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                          </>
                        : msg.content}
                    </div>
                    {/* Auto-Log Decision Button for AI messages with decisions */}
                    {msg.role === "assistant" && msg.content && detectDecisionInMessage(msg.content) && !streaming && (
                      <button
                        onClick={() => handleLogDecisionFromChat(i)}
                        style={{
                          marginTop: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          background: `${ACCENT}15`,
                          border: `1px solid ${ACCENT}40`,
                          borderRadius: 8,
                          color: ACCENT,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: "'DM Sans', sans-serif",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${ACCENT}25`;
                          e.currentTarget.style.borderColor = ACCENT;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${ACCENT}15`;
                          e.currentTarget.style.borderColor = `${ACCENT}40`;
                        }}
                      >
                        📝 Log to Journal
                      </button>
                    )}
                  </div>
                ))}
                {streaming && (
                  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                    <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`,
                      borderRadius: "16px 16px 16px 4px", padding: "10px 14px",
                      fontSize: 13, color: TEXT_DIM }}>
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEnd}/>
              </div>

              {/* Chat File Attachments Preview */}
              {chatFiles.length > 0 && (
                <div style={{ padding: "8px 16px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {chatFiles.map((f, i) => (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                      background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 8, fontSize: 12, color: ACCENT
                    }}>
                      <FileIcon size={12} color={ACCENT}/> {f.name}
                      <button onClick={() => setChatFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", padding: 0, marginLeft: 4, fontSize: 14, lineHeight: 1 }}>&times;</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested Prompt Chips */}
              {(() => {
                const suggestedPrompts = [
                  "What are my riskiest decisions?",
                  "Summarise my decision patterns",
                  "Which decisions need review?",
                  "What should I prioritise this week?",
                  "Show me stale decisions"
                ];
                const handleChipSend = async (promptText) => {
                  if (streaming) return;
                  setChatInput("");
                  const newMsgs = [...chatMsgs, { role: "user", content: promptText, msgId: generateMsgId() }];
                  setChatMsgs(newMsgs);
                  setStreaming(true);
                  try {
                    const activeFindings = parsedFindings.filter(f => !resolvedFindings.includes(f.id));
                    const totalExposureAmount = activeFindings.reduce((s, f) => s + (f.maxAmount || 0), 0);
                    const totalExposureStr = totalExposureAmount > 0
                      ? `${activeFindings.find(f => f.currencySymbol)?.currencySymbol || ''}${totalExposureAmount.toLocaleString()}`
                      : null;
                    const chiefContext = parsedFindings.length > 0 ? {
                      findings: parsedFindings.slice(0, 3).map(f => ({
                        title: f.pattern || '',
                        severity: f.tier || '',
                        impact: f.impact || '',
                        evidence: f.evidence ? (f.evidence.length > 250 ? f.evidence.slice(0, 250).replace(/\S*$/, '').trim() + '...' : f.evidence) : '',
                        fix: f.fix ? (f.fix.length > 300 ? f.fix.slice(0, 300).replace(/\S*$/, '').trim() + '...' : f.fix) : ''
                      })),
                      totalExposure: totalExposureStr,
                      scanType: scanMode,
                      domain: activeDomain,
                      scannedAt: scanResults?.timestamp || revenueScanResults?.timestamp || null,
                      dataSummary: localStorage.getItem('dao-uploaded-summary') || ''
                    } : null;
                    const chiefRes = await fetch('/api/chief', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: promptText, chiefContext })
                    });
                    const chiefData = await chiefRes.json();
                    const chiefRaw = chiefData.text || 'I was unable to generate a response. Please try again.';
                    const chiefConfMatch = chiefRaw.match(/\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b/i);
                    const chiefConf = chiefConfMatch ? chiefConfMatch[1].toUpperCase() : null;
                    const chiefText = chiefRaw.replace(/[-–—]*\s*\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b[^\n]*/gi, '').trim();
                    setChatMsgs(prev => [...prev, { role: 'assistant', content: chiefText, confidence: chiefConf, msgId: generateMsgId() }]);
                  } catch (e) {
                    setChatMsgs(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", confidence: null, failed: true, retryQuery: promptText, msgId: generateMsgId() }]);
                  }
                  setStreaming(false);
                };
                return (
                  <div style={{
                    padding: "8px 16px 0",
                    paddingBottom: '80px',
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    flexWrap: "nowrap",
                    scrollbarWidth: "none"
                  }}>
                    {suggestedPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleChipSend(prompt)}
                        disabled={streaming}
                        style={{
                          flexShrink: 0,
                          padding: "5px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          background: BG_SURFACE,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 20,
                          color: TEXT_DIM,
                          cursor: streaming ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "'DM Sans', sans-serif",
                          transition: "all 0.15s",
                          opacity: streaming ? 0.5 : 1
                        }}
                        onMouseEnter={e => {
                          if (!streaming) {
                            e.currentTarget.style.background = `${ACCENT}15`;
                            e.currentTarget.style.color = ACCENT;
                            e.currentTarget.style.borderColor = `${ACCENT}50`;
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = BG_SURFACE;
                          e.currentTarget.style.color = TEXT_DIM;
                          e.currentTarget.style.borderColor = BORDER;
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Chat Input */}
              <div style={{
                position: "sticky", bottom: 0, background: BG_DARK, borderTop: `1px solid ${BORDER}`, padding: "12px 16px",
              }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderTopColor = ACCENT; }}
                onDragLeave={e => { e.currentTarget.style.borderTopColor = BORDER; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderTopColor = BORDER; handleChatFiles(Array.from(e.dataTransfer.files)); }}
              >
                <div style={{ display: "flex", gap: 8, maxWidth: 800, margin: "0 auto", alignItems: "flex-end" }}>
                  <button onClick={() => chatFileRef.current?.click()} style={{ background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px", cursor: "pointer", color: TEXT_DIM, display: "flex", flexShrink: 0 }} title="Attach file">
                    <PaperclipIcon size={18}/>
                  </button>
                  <input ref={chatFileRef} type="file" multiple accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf,.doc,.docx" style={{ display: "none" }}
                    onChange={e => { handleChatFiles(Array.from(e.target.files)); e.target.value = ""; }}
                  />
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder={streaming ? "Thinking..." : "Ask about your operations, or drop a file here..."}
                    style={{ ...inputStyle, flex: 1, margin: 0 }}
                    disabled={streaming}
                  />
                  <button
                    onClick={handleMic}
                    title={micState === "error" ? "Voice not supported" : micState === "listening" ? "Listening…" : "Voice input"}
                    style={{
                      background: "none", border: "none", cursor: "pointer", fontSize: 20,
                      color: micState === "listening" ? "#EF4444" : "#64748B",
                      animation: micState === "listening" ? "pulse 1s infinite" : "none",
                      flexShrink: 0, padding: "6px"
                    }}
                  >🎤</button>
                  <button onClick={sendMessage} disabled={streaming || (!chatInput.trim() && chatFiles.length === 0)} style={{ ...btnPrimary, padding: "10px 16px", opacity: (chatInput.trim() || chatFiles.length > 0) && !streaming ? 1 : 0.4, flexShrink: 0 }}>
                    <SendIcon size={18} color="#fff"/>
                  </button>
                </div>
              </div>
            </div>
          )} />

          {/* ═══════ DASHBOARD VIEW ═══════ */}
            <Route path="/dashboard" element={(
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

              <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid #2d3748', borderRadius: 10,
                padding: '16px 20px', marginBottom: 20,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#718096',
                      fontWeight: 600, letterSpacing: 1,
                      textTransform: 'uppercase', marginBottom: 2 }}>
                      Command Centre
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
                      DAO v1.4
                    </div>
                  </div>
                  <div style={{ width: 1, height: 36,
                    background: '#2d3748' }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#718096', marginBottom: 2 }}>
                      Last Scan
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {commandCentreStats.lastScanTime
                        ? new Date(commandCentreStats.lastScanTime)
                            .toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit'
                            })
                        : 'No scans yet'}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 36, background: '#2d3748' }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#718096', marginBottom: 2 }}>
                      Total Scans
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {commandCentreStats.totalScans}
                    </div>
                  </div>
                  {commandCentreStats.lastScanType && (
                    <>
                      <div style={{ width: 1, height: 36,
                        background: '#2d3748' }} />
                      <div>
                        <div style={{ fontSize: 11, color: '#718096', marginBottom: 2 }}>
                          Last Type
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600,
                          color: '#805ad5', textTransform: 'capitalize' }}>
                          {commandCentreStats.lastScanType}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setScanMode('operational')}
                    style={{
                      background: '#553c9a', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13
                    }}>
                    ⚡ Run Scan
                  </button>
                  {autoBrief && (
                    <button
                      onClick={() => navigate("/brief")}
                      style={{
                        background: 'transparent', color: '#805ad5',
                        border: '1px solid #553c9a', borderRadius: 6,
                        padding: '8px 16px', cursor: 'pointer',
                        fontWeight: 600, fontSize: 13
                      }}>
                      📋 View Brief
                    </button>
                  )}
                </div>
              </div>

              {/* ── Hero CTA ── */}
              <div style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 14, padding: "20px 16px", marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: TEXT }}>Decision Intelligence, Activated.</h2>
                <p style={{ fontSize: 12, color: TEXT_DIM, margin: "0 0 14px" }}>Surface your top risks, opportunities, and decisions in 60 seconds.</p>
                <button onClick={() => navigate("/brief")} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
                  ⚡ Generate 60-second Brief
                </button>
                <button onClick={() => navigate("/chat")} style={{ background: "none", border: "none", color: ACCENT, fontSize: 12, cursor: "pointer", marginTop: 10, padding: 0, fontFamily: "'DM Sans', sans-serif", display: "block", width: "100%", textAlign: "center" }}>
                  💬 Discuss with AI
                </button>
              </div>

              {/* ── 4-step flow ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
                {[["📁", "Upload"], ["🔍", "Scan"], ["✅", "Decide"], ["📋", "Track"]].map(([icon, label], i, arr) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, letterSpacing: 0.5 }}>{label}</span>
                    </span>
                    {i < arr.length - 1 && <span style={{ color: BORDER, margin: "0 2px", fontSize: 14 }}>→</span>}
                  </span>
                ))}
              </div>

              {/* ── DAL Health widget ── */}
              {(() => {
                const today = new Date().toISOString().split("T")[0];
                const due = journal.filter(e => e.review_date && e.review_date <= today && e.status !== "Reviewed").length;
                return (
                  <button onClick={() => navigate("/journal")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: BG_CARD, border: `1px solid ${due > 0 ? AMBER : GREEN}40`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", marginBottom: 16, textAlign: "left", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}>
                    <span style={{ fontSize: 12, color: TEXT_DIM }}>Reviews Due</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: due > 0 ? AMBER : GREEN }}>{due > 0 ? `${due} pending` : "✓ No reviews due"}</span>
                  </button>
                );
              })()}

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#E2E8F0" }}>Command Centre</h2>
                  <p style={{ color: "#94A3B8", fontSize: 12, margin: 0 }}>{new Date().toLocaleDateString("en-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
                <button onClick={generateBoardReport} style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 700, color: ACCENT, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  ⬇ Export Board Report
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "ACTIVE FINDINGS", value: parsedFindings.filter(f => !resolvedFindings.includes(f.id)).length, color: parsedFindings.filter(f => !resolvedFindings.includes(f.id) && f.tier === "3").length > 0 ? "#EF4444" : "#F59E0B", sub: `${resolvedFindings.length} resolved` },
                  { label: "FINANCIAL EXPOSURE", value: `RM ${parsedFindings.filter(f => !resolvedFindings.includes(f.id)).reduce((s, f) => s + f.maxAmount, 0).toLocaleString()}`, color: "#EF4444", sub: "active & unresolved" },
                  { label: "DECISIONS LOGGED", value: journal.length, color: "#0EA5E9", sub: `${journal.filter(j => j.status === "Confirmed").length} pending review` },
                  { label: "OVERDUE REVIEWS", value: journal.filter(j => new Date(j.review_date) < new Date() && j.status !== "Reviewed").length, color: "#F59E0B", sub: "need attention" }
                ].map((stat, i) => (
                  <div key={i} style={{ background: "#111827", border: "1px solid #1E3A5F", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>{stat.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{stat.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#111827", border: "1px solid #1E3A5F", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <HealthRing resolved={resolvedFindings.length} total={parsedFindings.length}/>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8, textAlign: "center", whiteSpace: "nowrap" }}>{resolvedFindings.length}/{parsedFindings.length} findings</div>
                </div>
                <div style={{ background: "#111827", border: "1px solid #1E3A5F", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#0EA5E9", marginBottom: 12 }}>TOP PRIORITIES THIS WEEK</div>
                  {parsedFindings.filter(f => !resolvedFindings.includes(f.id)).sort((a, b) => parseInt(a.tier) - parseInt(b.tier) || b.dailyCost - a.dailyCost).slice(0, 3).map((f, i, arr) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? "1px solid #1E3A5F" : "none" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${f.tier === "3" ? "#EF4444" : f.tier === "2" ? "#F59E0B" : "#10B981"}20`, color: f.tier === "3" ? "#EF4444" : f.tier === "2" ? "#F59E0B" : "#10B981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0", marginBottom: 2, lineHeight: 1.3 }}>{f.pattern}</div>
                        {f.dailyCost > 0 && <div style={{ fontSize: 11, color: "#EF4444" }}>RM {f.dailyCost.toLocaleString()} / day</div>}
                      </div>
                      <button onClick={() => navigate("/situations")} style={{ background: "none", border: "none", color: "#0EA5E9", cursor: "pointer", fontSize: 11, padding: 0, flexShrink: 0 }}>View →</button>
                    </div>
                  ))}
                  {parsedFindings.filter(f => !resolvedFindings.includes(f.id)).length === 0 && (
                    <div style={{ fontSize: 13, color: "#94A3B8", padding: "16px 0", textAlign: "center" }}>
                      {parsedFindings.length > 0 ? "🎉 All findings resolved!" : "Run an Enterprise Scan to populate priorities."}
                    </div>
                  )}
                </div>
              </div>
              {journal.length > 0 && (
                <div style={{ background: "#111827", border: "1px solid #1E3A5F", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#0EA5E9" }}>RECENT DECISIONS</div>
                    <button onClick={() => navigate("/journal")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 11 }}>View all →</button>
                  </div>
                  {journal.slice(0, 3).map((entry, i) => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: i < Math.min(journal.length, 3) - 1 ? 10 : 0, marginBottom: i < Math.min(journal.length, 3) - 1 ? 10 : 0, borderBottom: i < Math.min(journal.length, 3) - 1 ? "1px solid #1E3A5F" : "none" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: entry.tier === "3" ? "#EF444420" : entry.tier === "2" ? "#F59E0B20" : "#10B98120", color: entry.tier === "3" ? "#EF4444" : entry.tier === "2" ? "#F59E0B" : "#10B981", flexShrink: 0 }}>T{entry.tier}</span>
                      <div style={{ flex: 1, fontSize: 13, color: "#E2E8F0" }}>{entry.statement}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }}>{entry.date}</div>
                    </div>
                  ))}
                </div>
              )}
              {parsedFindings.length === 0 && datasets.length === 0 && (
                <div style={{ background: "#111827", border: "1px solid #1E3A5F", borderRadius: 12, padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: "#E2E8F0" }}>Start Your First Scan</h3>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 16px" }}>Upload operational data to see findings, financial exposure, and priorities here.</p>
                  <button onClick={() => navigate("/connect")} style={{ background: "#0EA5E9", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Upload Data →</button>
                </div>
              )}
              {/* ── Decision Health widget ── */}
              {decisionHealth && decisionHealth.results && decisionHealth.results.length > 0 && (
                <div style={{margin:'16px 0',border:'1px solid #2a2a4a',borderRadius:'12px',
                  overflow:'hidden'}}>
                  <div
                    onClick={() => setHealthExpanded(!healthExpanded)}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                      padding:'12px 16px',background:'#12122a',cursor:'pointer'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{fontSize:'16px'}}>🏥</span>
                      <span style={{fontSize:'13px',fontWeight:'600',color:'#e0e0ff'}}>
                        Decision Health
                      </span>
                      <span style={{fontSize:'11px',background:'#2a2a5a',color:'#8888ff',
                        border:'1px solid #4a4a8a',borderRadius:'10px',padding:'2px 8px'}}>
                        {decisionHealth.results.filter(r => r.status === 'At Risk').length > 0
                          ? `${decisionHealth.results.filter(r => r.status === 'At Risk').length} At Risk`
                          : decisionHealth.results.filter(r => r.status === 'Watch').length > 0
                          ? `${decisionHealth.results.filter(r => r.status === 'Watch').length} Watch`
                          : 'All Healthy'}
                      </span>
                    </div>
                    <span style={{color:'#8888bb',fontSize:'12px'}}>
                      {healthExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                  {healthExpanded && (
                    <div style={{background:'#0d0d1f',padding:'12px 16px'}}>
                      {decisionHealth.results.map(result => (
                        <div key={result.id} style={{display:'flex',justifyContent:'space-between',
                          alignItems:'flex-start',padding:'10px 0',
                          borderBottom:'1px solid #1a1a3a'}}>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',
                              marginBottom:'4px'}}>
                              <span style={{fontSize:'11px',fontWeight:'600',
                                color: result.status === 'At Risk' ? '#ff6b6b'
                                  : result.status === 'Watch' ? '#ffa500' : '#44ff88',
                                textTransform:'uppercase'}}>
                                {result.status}
                              </span>
                              <span style={{fontSize:'10px',color:'#666688'}}>
                                {result.urgency}
                              </span>
                            </div>
                            <div style={{fontSize:'12px',color:'#aaaacc',lineHeight:'1.4'}}>
                              {result.reasoning}
                            </div>
                          </div>
                          {(result.status === 'Watch' || result.status === 'At Risk') && (
                            <button
                              onClick={() => navigate("/journal")}
                              style={{marginLeft:'12px',padding:'4px 10px',fontSize:'11px',
                                background:'#2a2a5a',color:'#8888ff',border:'1px solid #4a4a8a',
                                borderRadius:'6px',cursor:'pointer',whiteSpace:'nowrap'}}>
                              Review Now
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Pattern Memory panel ── */}
              <PatternMemoryPanel patterns={patterns} />

              {/* ── Risk Radar panel ── */}
              <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, cursor: "pointer" }} onClick={() => setShowRiskRadar(v => !v)}>
                      🎯 Decision Risk Radar
                    </span>
                    {riskRadar.length > 0 && (
                      <span style={{ background: `${RED}30`, color: RED, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 8px" }}>
                        {riskRadar.length}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={runRiskRadar}
                      disabled={riskRadarLoading}
                      style={{ background: riskRadarLoading ? BG_SURFACE : `${ACCENT}20`, color: riskRadarLoading ? TEXT_DIM : ACCENT, border: `1px solid ${riskRadarLoading ? BORDER : ACCENT}40`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: riskRadarLoading ? "not-allowed" : "pointer" }}
                    >
                      {riskRadarLoading ? "Scanning..." : "Run Radar"}
                    </button>
                    <span style={{ fontSize: 12, color: TEXT_DIM, cursor: "pointer" }} onClick={() => setShowRiskRadar(v => !v)}>
                      {showRiskRadar ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
                {showRiskRadar && (
                  <div>
                    {riskRadar.length === 0 && !riskRadarLoading ? (
                      <p style={{ fontSize: 13, color: TEXT_DIM, margin: "8px 0 0" }}>Run the radar to surface decision risks.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {riskRadar.map((risk, i) => (
                          <div key={i} style={{ background: BG_SURFACE, borderRadius: 8, padding: "10px 12px", border: `1px solid ${BORDER}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                                background: risk.severity === "High" ? `${RED}25` : risk.severity === "Medium" ? `${AMBER}25` : "#64748B25",
                                color: risk.severity === "High" ? RED : risk.severity === "Medium" ? AMBER : "#94A3B8"
                              }}>
                                {risk.severity}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM }}>{risk.riskType}</span>
                            </div>
                            <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginBottom: 2 }}>{(risk.statement || "").slice(0, 60)}{(risk.statement || "").length > 60 ? "…" : ""}</div>
                            <div style={{ fontSize: 12, color: TEXT_DIM }}>{risk.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Board Pack panel ── */}
              <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>📋 Board Pack</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={handleGenerateBoardPack}
                      disabled={boardPackLoading}
                      style={{ background: boardPackLoading ? BG_SURFACE : `${ACCENT}20`, color: boardPackLoading ? TEXT_DIM : ACCENT, border: `1px solid ${boardPackLoading ? BORDER : ACCENT}40`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: boardPackLoading ? "not-allowed" : "pointer" }}
                    >
                      {boardPackLoading ? "Generating..." : "Generate Board Pack"}
                    </button>
                    {showBoardPack && (
                      <button onClick={() => setShowBoardPack(false)} style={{ background: "transparent", color: TEXT_DIM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Close</button>
                    )}
                  </div>
                </div>
                {showBoardPack && boardPack && (
                  <div>
                    {/* Summary tiles */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                      {[
                        { label: "Total Decisions", value: boardPack.summary.totalDecisions },
                        { label: "Active", value: boardPack.summary.activeDecisions, color: GREEN },
                        { label: "Closed", value: boardPack.summary.closedDecisions, color: TEXT_DIM },
                        { label: "Open Risks", value: boardPack.summary.openRisks, color: RED },
                        { label: "Patterns", value: boardPack.summary.patternsDetected, color: AMBER }
                      ].map((tile, i) => (
                        <div key={i} style={{ flex: "1 1 80px", background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: tile.color || TEXT }}>{tile.value}</div>
                          <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>{tile.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Active Decisions */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 8, letterSpacing: 0.5 }}>Active Decisions</div>
                      {boardPack.activeDecisions.length === 0 ? (
                        <p style={{ fontSize: 12, color: TEXT_DIM }}>No active decisions.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {boardPack.activeDecisions.map((d, i) => (
                            <div key={i} style={{ background: BG_SURFACE, borderRadius: 8, padding: "10px 12px", border: `1px solid ${BORDER}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, background: `${ACCENT}20`, color: ACCENT, borderRadius: 6, padding: "2px 7px" }}>Tier {d.tier}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, background: d.lifecycleStatus === "Active" ? `${GREEN}20` : `${AMBER}20`, color: d.lifecycleStatus === "Active" ? GREEN : AMBER, borderRadius: 6, padding: "2px 7px" }}>{d.lifecycleStatus}</span>
                                <span style={{ fontSize: 11, color: TEXT_DIM }}>Confidence: {confidenceLabel(d.confidenceScore)}</span>
                              </div>
                              <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginBottom: 4 }}>{d.statement}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: d.review_date ? 4 : 0 }}>
                                {(d.tags || []).map((tag, ti) => (
                                  <span key={ti} style={{ fontSize: 10, background: `${ACCENT}15`, color: ACCENT, borderRadius: 10, padding: "1px 7px" }}>{tag}</span>
                                ))}
                              </div>
                              {d.review_date && (
                                <div style={{ fontSize: 11, color: TEXT_DIM }}>Review: {d.review_date}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Top Risk Signals */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 8, letterSpacing: 0.5 }}>Top Risk Signals</div>
                      {boardPack.risks.length === 0 ? (
                        <p style={{ fontSize: 12, color: TEXT_DIM }}>No risk signals. Run the Risk Radar first.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {boardPack.risks.map((risk, i) => (
                            <div key={i} style={{ background: BG_SURFACE, borderRadius: 8, padding: "10px 12px", border: `1px solid ${BORDER}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: risk.severity === "High" ? `${RED}25` : risk.severity === "Medium" ? `${AMBER}25` : "#64748B25", color: risk.severity === "High" ? RED : risk.severity === "Medium" ? AMBER : "#94A3B8" }}>{risk.severity}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM }}>{risk.riskType}</span>
                              </div>
                              <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginBottom: 2 }}>{risk.statement}</div>
                              <div style={{ fontSize: 12, color: TEXT_DIM }}>{risk.reason}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Decision Patterns */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 8, letterSpacing: 0.5 }}>Decision Patterns</div>
                      {boardPack.patterns.length === 0 ? (
                        <p style={{ fontSize: 12, color: TEXT_DIM }}>No patterns detected yet.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {boardPack.patterns.map((p, i) => (
                            <div key={i} style={{ background: BG_SURFACE, borderRadius: 8, padding: "8px 12px", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, flex: 1 }}>{p.label}</span>
                              <span style={{ fontSize: 11, color: TEXT_DIM }}>Count: {p.count}</span>
                              <span style={{ fontSize: 11, color: TEXT_DIM }}>Avg Confidence: {p.avgConfidence}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Export */}
                    <button onClick={exportBoardPackJSON} style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}40`, borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>

            </div>
          )} />

          {/* ═══════ SCAN VIEW ═══════ */}
            <Route path="/situations" element={(() => {
              const priorities = situationAssessment?.assessment?.priorities || [];
              return priorities.length >= 2
                ? <SituationQueue priorities={priorities} />
                : <EmptyState dataConnected={datasets.length > 0} onScan={runScan} />;
            })()} />

          {/* ═══════ JOURNAL VIEW ═══════ */}
            <Route path="/journal" element={(
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Decision Ledger</h2>
                <button onClick={() => setShowJournalForm(true)} style={btnPrimary}><PlusIcon size={16}/> Log Decision</button>
              </div>

              {showJournalForm && (
                <div style={{ background: BG_CARD, borderRadius: 12, border: `1px solid ${ACCENT}40`, padding: 20, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>New Decision Entry</h3>
                  <label style={labelStyle}>
                    <span style={labelText}>Decision Statement</span>
                    <textarea value={jf.statement} onChange={e => setJf({...jf, statement: e.target.value})} placeholder="What was decided..." rows={2} style={{...inputStyle, resize: "vertical"}}/>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={labelStyle}>
                      <span style={labelText}>Severity Tier</span>
                      <select value={jf.tier} onChange={e => { const v = e.target.value; setJf({...jf, tier: v}); setMatchingPatterns(findMatchingPatterns({...jf, tier: v}, patterns)); }} style={inputStyle}>
                        <option value="1">Tier 1 — Low</option>
                        <option value="2">Tier 2 — Medium</option>
                        <option value="3">Tier 3 — High</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <span style={labelText}>Decision Type</span>
                      <select value={jf.type} onChange={e => { const v = e.target.value; setJf({...jf, type: v}); setMatchingPatterns(findMatchingPatterns({...jf, type: v}, patterns)); }} style={inputStyle}>
                        <option value="technical">Technical</option>
                        <option value="human">Human</option>
                        <option value="political">Political</option>
                        <option value="cultural">Cultural</option>
                        <option value="ethical">Ethical</option>
                        <option value="compound">Compound</option>
                      </select>
                    </label>
                  </div>
                  <label style={labelStyle}>
                    <span style={labelText}>Evidence Base</span>
                    <textarea value={jf.evidence} onChange={e => setJf({...jf, evidence: e.target.value})} placeholder="What data supports this decision..." rows={2} style={{...inputStyle, resize: "vertical"}}/>
                  </label>
                  <label style={labelStyle}>
                    <span style={labelText}>Assumptions (flagged for validation)</span>
                    <textarea value={jf.assumptions} onChange={e => setJf({...jf, assumptions: e.target.value})} placeholder="List assumptions — note which are data-backed vs inferred..." rows={2} style={{...inputStyle, resize: "vertical"}}/>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={labelStyle}>
                      <span style={labelText}>Review In (days)</span>
                      <select value={jf.reviewDays} onChange={e => setJf({...jf, reviewDays: parseInt(e.target.value)})} style={inputStyle}>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                        <option value="60">60 days</option>
                        <option value="90">90 days</option>
                      </select>
                    </label>
                  </div>
                  {parseInt(jf.tier) >= 2 && (
                    <>
                      <label style={labelStyle}>
                        <span style={labelText}>Expected Outcome</span>
                        <textarea value={jf.expected} onChange={e => setJf({...jf, expected: e.target.value})} placeholder="What should happen if this decision is correct..." rows={2} style={{...inputStyle, resize: "vertical"}}/>
                      </label>
                      <label style={labelStyle}>
                        <span style={labelText}>Owner</span>
                        <input type="text" value={jf.owner} onChange={e => setJf({...jf, owner: e.target.value})} placeholder="Decision owner name or role..." style={inputStyle}/>
                      </label>
                      <label style={labelStyle}>
                        <span style={labelText}>Review Date</span>
                        <input type="date" value={jf.review_date} onChange={e => setJf({...jf, review_date: e.target.value})} style={inputStyle}/>
                      </label>
                    </>
                  )}
                  <label style={labelStyle}>
                    <span style={labelText}>Decision Confidence (1 = Low, 5 = High)</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="range" min={1} max={5} step={1}
                        value={jf.confidenceScore}
                        onChange={e => setJf({...jf, confidenceScore: parseInt(e.target.value)})}
                        style={{ flex: 1, accentColor: ACCENT }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, minWidth: 36, textAlign: "right" }}>{jf.confidenceScore} / 5</span>
                    </div>
                  </label>
                  <label style={labelStyle}>
                    <span style={labelText}>Tags (comma-separated)</span>
                    <input
                      type="text"
                      value={jf.tagsRaw}
                      onChange={e => { setJf({...jf, tagsRaw: e.target.value}); setMatchingPatterns(findMatchingPatterns(jf, patterns)); }}
                      placeholder="e.g. budget, Q2, risk"
                      style={inputStyle}
                    />
                  </label>
                  {matchingPatterns.length > 0 && (
                    <div style={{ background: "#fffbe6", border: "1px solid #ffe58f",
                      borderRadius: 6, padding: "8px 12px", marginTop: 8 }}>
                      <strong>⚠ Pattern detected:</strong>{" "}
                      {matchingPatterns.map(p => p.label).join(", ")}
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>
                        — you've made similar decisions before
                      </span>
                    </div>
                  )}
                  <label style={labelStyle}>
                    <span style={labelText}>Status</span>
                    <select value={jf.lifecycleStatus} onChange={e => setJf({...jf, lifecycleStatus: e.target.value})} style={inputStyle}>
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                      <option value="Pending">Pending</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </label>
                  {dalErrors.length > 0 && (
                    <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>
                      {dalErrors.map((err, i) => <div key={i}>⚠ {err}</div>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={addJournalEntry} disabled={!jf.statement} style={{ ...btnPrimary, opacity: jf.statement ? 1 : 0.4 }}>Save to Journal</button>
                    <button onClick={() => setShowJournalForm(false)} style={btnSmall}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Challenge Check Modal (Tier 2+) ── */}
              {challengeOpen && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: AMBER, marginBottom: 8 }}>CHALLENGE CHECK — TIER {challengePending?.tier}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{challengePending?.statement}</div>
                    <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 20 }}>Review the checklist below before confirming this decision.</div>
                    {[
                      "Is the evidence sufficient to act?",
                      "Have key assumptions been challenged?",
                      "Is this decision reversible if wrong?",
                      "Are affected stakeholders informed?",
                      "Has a fallback option been identified?"
                    ].map((flag, i) => (
                      <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checkedFlags.includes(flag)}
                          onChange={e => setCheckedFlags(prev => e.target.checked ? [...prev, flag] : prev.filter(f => f !== flag))}
                          style={{ accentColor: ACCENT, width: 16, height: 16 }}
                        />
                        <span style={{ fontSize: 13, color: TEXT }}>{flag}</span>
                      </label>
                    ))}
                    {rationaleLoading && (
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 8, marginBottom: 4 }}>Generating rationale via Claude…</div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                      <button onClick={confirmDecision} disabled={rationaleLoading} style={{ ...btnPrimary, opacity: rationaleLoading ? 0.5 : 1 }}>
                        {rationaleLoading ? "Saving…" : "Confirm"}
                      </button>
                      <button onClick={() => setChallengeOpen(false)} disabled={rationaleLoading} style={btnSmall}>Revise</button>
                      <button onClick={() => { setChallengeOpen(false); setChallengePending(null); setCheckedFlags([]); setJf({ statement: "", tier: "1", type: "technical", evidence: "", assumptions: "", confidence: "moderate", expected: "", owner: "", review_date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(), reviewDays: 30 }); }} disabled={rationaleLoading} style={{ ...btnSmall, color: RED }}>Defer</button>
                    </div>
                  </div>
                </div>
              )}

              {decisionProfile && (
                <div style={{ background: "#A78BFA10", border: "1px solid #A78BFA40", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: "#A78BFA" }}>DECISION PROFILE — THEORY OF MIND</div>
                    <span style={{ fontSize: 11, color: TEXT_DIM }}>Based on {decisionProfile.basedOn} decisions</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: TEXT }}>{decisionProfile.text}</div>
                </div>
              )}
              {profileLoading && (
                <div style={{ background: "#A78BFA10", border: "1px solid #A78BFA40", borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 13, color: "#A78BFA" }}>
                  Analysing your decision patterns... Building your Decision Profile.
                </div>
              )}
              {/* ── Review tabs ── */}
              <div style={{ display: "flex", gap: 4, background: "#0B1120", borderRadius: 12, padding: 4, marginBottom: 16 }}>
                <button onClick={() => setReviewTab("all")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: reviewTab === "all" ? BG_CARD : "transparent", color: reviewTab === "all" ? TEXT : TEXT_DIM, boxShadow: reviewTab === "all" ? "0 1px 4px rgba(0,0,0,0.3)" : "none", transition: "all 0.2s" }}>All Decisions</button>
                <button onClick={() => setReviewTab("queue")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: reviewTab === "queue" ? BG_CARD : "transparent", color: reviewTab === "queue" ? AMBER : TEXT_DIM, boxShadow: reviewTab === "queue" ? "0 1px 4px rgba(0,0,0,0.3)" : "none", transition: "all 0.2s" }}>📋 Review Queue</button>
              </div>

              {/* ── Journal list ── */}
              {(() => {
                const today = new Date().toISOString().split("T")[0];
                const queueEntries = journal.filter(e => e.review_date && e.review_date <= today && e.status !== "Reviewed");
                const displayEntries = reviewTab === "queue" ? queueEntries : journal;

                if (displayEntries.length === 0) return (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                    <BookIcon size={48} color={TEXT_DIM}/>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: "16px 0 8px" }}>
                      {reviewTab === "queue" ? "No Decisions Due for Review" : "No Decisions Logged"}
                    </h3>
                    <p style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
                      {reviewTab === "queue" ? "Decisions with a review date on or before today will appear here." : "The Decision Ledger is your institutional memory. Every decision logged here is permanent, governed, and trackable."}
                    </p>
                  </div>
                );

                return displayEntries.map((entry) => {
                  const isOverdue = entry.review_date && entry.review_date < today;
                  const isDueToday = entry.review_date && entry.review_date === today;
                  const inQueue = entry.review_date && entry.review_date <= today && entry.status !== "Reviewed";
                  return (
                    <div key={entry.id} style={{ background: BG_CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_DIM }}>{entry.id}</span>
                          <h4 style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 0" }}>{entry.statement}
                            {copilotReadyIds.includes(entry.id) && (
                              <span title="DAO Chief Ready: the AI assistant has sufficient context on this assumption to support a decision review session." style={{fontSize:'10px',background:'#2a2a5a',color:'#8888ff',
                                border:'1px solid #4a4a8a',borderRadius:'4px',padding:'2px 6px',
                                marginLeft:'8px',verticalAlign:'middle'}}>
                                ⚡ DAO Chief Ready
                              </span>
                            )}
                          </h4>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${RED}20`, color: RED }}>Overdue</span>}
                          {isDueToday && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${AMBER}20`, color: AMBER }}>Due Today</span>}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                            background: entry.tier === "1" ? `${RED}20` : entry.tier === "2" ? `${AMBER}20` : `${GREEN}20`,
                            color: entry.tier === "1" ? RED : entry.tier === "2" ? AMBER : GREEN
                          }}>Tier {entry.tier}</span>
                          {entry.lifecycleStatus && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                              background: entry.lifecycleStatus === "Draft" ? "#94A3B820" : entry.lifecycleStatus === "Active" ? "#0EA5E920" : entry.lifecycleStatus === "Monitoring" ? "#F59E0B20" : entry.lifecycleStatus === "Pending" ? "#A855F720" : "#10B98120",
                              color: entry.lifecycleStatus === "Draft" ? "#94A3B8" : entry.lifecycleStatus === "Active" ? "#0EA5E9" : entry.lifecycleStatus === "Monitoring" ? "#F59E0B" : entry.lifecycleStatus === "Pending" ? "#A855F7" : "#10B981"
                            }}>{entry.lifecycleStatus}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: TEXT_DIM }}>
                        <span>{entry.date}</span>
                        <span>{entry.type}</span>
                        <span>{confidenceLabel(entry.confidenceScore)}</span>
                        <span>Review: {entry.review_date}</span>
                        <span title={entry.status === "Confirmed" ? "Confirmed: this assumption has been validated and logged. It still appears in the review queue until marked Reviewed." : undefined} style={{ color: entry.status === "Reviewed" ? GREEN : entry.status === "resolved" ? GREEN : entry.status === "in_progress" ? AMBER : TEXT_DIM }}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.evidence && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "8px 0 0", lineHeight: 1.5 }}><strong>Evidence:</strong> {entry.evidence}</p>}
                      {entry.assumptions && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "4px 0 0", lineHeight: 1.5 }}><strong>Assumptions:</strong> {entry.assumptions}</p>}
                      {entry.expected && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "4px 0 0", lineHeight: 1.5 }}><strong>Expected:</strong> {entry.expected}</p>}
                      {entry.tags && entry.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {entry.tags.map((tag, ti) => (
                            <span key={ti} style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#1E293B", color: "#94A3B8", border: "1px solid #1E3A5F", fontWeight: 500 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                      {inQueue && (
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => {
                            setReviewModal(entry);
                            setReviewForm({ verdict: "On Track", actual_outcome: "", lesson: "", variance: "", reviewNotes: "", updateStatus: "" });
                          }} style={{ ...btnSmall, color: ACCENT, borderColor: `${ACCENT}40` }}>📝 Review</button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* ── Review modal ── */}
              {reviewModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                  <div style={{ background: BG_SURFACE, borderRadius: 16, border: `1px solid ${ACCENT}40`, padding: 24, width: "100%", maxWidth: 480 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Review Decision</h3>
                    <p style={{ fontSize: 12, color: TEXT_DIM, margin: "0 0 16px", lineHeight: 1.5 }}>{reviewModal.statement}</p>
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM, display: "block", marginBottom: 8 }}>Verdict</span>
                      <div style={{ display: "flex", gap: 16 }}>
                        {["On Track", "Variance Noted", "Off Track", "Cancelled"].map(v => (
                          <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: reviewForm.verdict === v ? 700 : 400, color: reviewForm.verdict === v ? (VERDICT_COLOR[v] ?? TEXT_DIM) : TEXT_DIM }}>
                            <input type="radio" name="verdict" value={v} checked={reviewForm.verdict === v} onChange={() => setReviewForm({...reviewForm, verdict: v})} style={{ accentColor: VERDICT_COLOR[v] ?? TEXT_DIM }}/>
                            {v}
                          </label>
                        ))}
                      </div>
                    </div>
                    {!copilotVariance.variance && !copilotVariance.loading && (
                      <button
                        onClick={() => {
                          const activeDomain = localStorage.getItem('dao-active-domain') || '';
                          setCopilotVariance(prev => ({...prev, loading: true}));
                          fetch('/api/variance', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                              decisionTitle: reviewModal.statement || reviewModal.title || reviewModal.text || '',
                              context: reviewModal.context || reviewModal.evidence || '',
                              rationale: reviewModal.rationale || reviewModal.assumptions || '',
                              tier: reviewModal.tier || 'Tier 1',
                              reviewNotes: reviewForm.reviewNotes || '',
                              uploadedDataSummary: '',
                              activeDomain
                            })
                          })
                          .then(r => r.json())
                          .then(data => {
                            setCopilotVariance({
                              variance: data.variance,
                              confidence: data.confidence,
                              reasoning: data.reasoning,
                              loading: false
                            });
                            console.log('[v1.3] Copilot variance loaded:', data);
                          })
                          .catch(() => setCopilotVariance({variance:null,confidence:null,reasoning:null,loading:false}));
                        }}
                        style={{
                          marginTop: '12px',
                          marginBottom: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #4a4a8a',
                          background: '#1a1a2e',
                          color: '#8888ff',
                          fontSize: '13px',
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        Get DAO Chief Suggestion
                      </button>
                    )}
                    {copilotVariance && copilotVariance.variance && !copilotVariance.loading && (
                      <div style={{background:'#1a1a2e',border:'1px solid #4a4a8a',borderRadius:'8px',
                        padding:'12px',marginBottom:'12px'}}>
                        <div style={{fontSize:'11px',color:'#8888bb',marginBottom:'6px',
                          textTransform:'uppercase',letterSpacing:'1px'}}>
                          ⚡ DAO Chief Suggestion
                        </div>
                        <div style={{fontSize:'13px',color:'#e0e0ff',marginBottom:'4px'}}>
                          <strong>{copilotVariance.variance}</strong>
                          <span style={{color:'#8888bb',marginLeft:'8px'}}>
                            ({copilotVariance.confidence} confidence)
                          </span>
                        </div>
                        <div style={{fontSize:'12px',color:'#aaaacc',lineHeight:'1.4'}}>
                          {copilotVariance.reasoning}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM, display: "block", marginBottom: 8 }}>Outcome vs Expected (required)</span>
                      <div style={{ display: "flex", gap: 16 }}>
                        {["Better","Same","Worse"].map(v => (
                          <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: reviewForm.variance === v ? 700 : 400, color: reviewForm.variance === v ? (v === "Better" ? GREEN : v === "Worse" ? RED : AMBER) : TEXT_DIM }}>
                            <input type="radio" name="variance"
                              checked={reviewForm.variance === v}
                              onChange={() => { setReviewForm(f => ({...f, variance: v})); setHumanOverrode(true); }}
                              style={{ accentColor: v === "Better" ? GREEN : v === "Worse" ? RED : AMBER }}
                            /> {v === "Better" ? "⬆ Better" : v === "Same" ? "➡ Same" : "⬇ Worse"}
                          </label>
                        ))}
                      </div>
                      {copilotVariance && copilotVariance.loading && (
                        <p style={{color:'#888',fontSize:'0.85rem',marginTop:'8px'}}>DAO Chief is analysing...</p>
                      )}
                    </div>
                    <label style={labelStyle}>
                      <span style={labelText}>Actual Outcome *</span>
                      <textarea value={reviewForm.actual_outcome} onChange={e => setReviewForm({...reviewForm, actual_outcome: e.target.value})} placeholder="What actually happened?" rows={3} style={{...inputStyle, resize: "vertical"}}/>
                    </label>
                    <label style={labelStyle}>
                      <span style={labelText}>Lesson *</span>
                      <textarea value={reviewForm.lesson} onChange={e => setReviewForm({...reviewForm, lesson: e.target.value})} placeholder="What would you do differently?" rows={3} style={{...inputStyle, resize: "vertical"}}/>
                    </label>
                    <label style={labelStyle}>
                      <span style={labelText}>Review Notes (optional)</span>
                      <textarea value={reviewForm.reviewNotes} onChange={e => setReviewForm({...reviewForm, reviewNotes: e.target.value})} placeholder="What changed? What did you learn?" rows={3} style={{...inputStyle, resize: "vertical"}}/>
                    </label>
                    <label style={labelStyle}>
                      <span style={labelText}>Update Status</span>
                      <select value={reviewForm.updateStatus} onChange={e => setReviewForm({...reviewForm, updateStatus: e.target.value})} style={inputStyle}>
                        <option value="">— Select status (default after review: Monitoring) —</option>
                        <option value="Active">Active</option>
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Monitoring">Monitoring</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={submitReview} disabled={!reviewForm.actual_outcome.trim() || !reviewForm.lesson.trim() || !reviewForm.variance} style={{ ...btnPrimary, opacity: reviewForm.actual_outcome.trim() && reviewForm.lesson.trim() && reviewForm.variance ? 1 : 0.4 }}>Submit Review</button>
                      <button onClick={() => {
                        setReviewModal(null);
                        setCopilotVariance({variance:null,confidence:null,reasoning:null,loading:false});
                        setHumanOverrode(false);
                      }} style={btnSmall}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )} />

          {/* ═══════ CHANGE TRACKER VIEW ═══════ */}
            <Route path="/track" element={(
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Change Tracker</h2>
                  <p style={{ fontSize: 12, color: TEXT_DIM, margin: 0 }}>Track AI & digital transformation implementation progress</p>
                </div>
                <button onClick={() => setShowChangeForm(true)} style={btnPrimary}><PlusIcon size={16}/> New Project</button>
              </div>
              {showChangeForm && (
                <div style={{ background: BG_CARD, borderRadius: 12, border: `1px solid ${ACCENT}40`, padding: 20, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>New Implementation Project</h3>
                  <label style={labelStyle}>
                    <span style={labelText}>Project Name</span>
                    <input value={cf.name} onChange={e => setCf({...cf, name: e.target.value})} placeholder="e.g. Decision Accountability OS Rollout" style={inputStyle}/>
                  </label>
                  <label style={labelStyle}>
                    <span style={labelText}>Description</span>
                    <input value={cf.description} onChange={e => setCf({...cf, description: e.target.value})} placeholder="e.g. Enterprise-wide AI implementation for Operations division" style={inputStyle}/>
                  </label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={addChangeProject} disabled={!cf.name} style={{ ...btnPrimary, opacity: cf.name ? 1 : 0.4 }}>Create Project</button>
                    <button onClick={() => setShowChangeForm(false)} style={btnSmall}>Cancel</button>
                  </div>
                </div>
              )}
              {changeProjects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                  <ClipboardIcon size={48} color={TEXT_DIM}/>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: "16px 0 8px" }}>No Projects Yet</h3>
                  <p style={{ fontSize: 14, maxWidth: 360, margin: "0 auto 16px" }}>Create a project for each AI or digital transformation implementation you are rolling out. Track progress workstream by workstream with RAG status.</p>
                  <button onClick={() => setShowChangeForm(true)} style={btnPrimary}>Create First Project</button>
                </div>
              ) : (
                changeProjects.map(project => (
                  <ChangeProjectCard key={project.id} project={project} onUpdateWorkstream={updateWorkstream}/>
                ))
              )}
            </div>
          )} />

          {/* ═══════ BRIEF VIEW ═══════ */}
            <Route path="/brief" element={(
            <BriefView
              profile={profile}
              onBack={() => navigate("/dashboard")}
              onChat={() => navigate("/chat")}
              onNavigate={(v) => {
                const onNavMap = { dashboard: "/dashboard", chat: "/chat", scan: "/situations", journal: "/journal", track: "/track", data: "/connect", brief: "/brief", board: "/board" };
                navigate(onNavMap[v] || ("/" + v));
              }}
            />
          )} />

            <Route path="/connect" element={(
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>Data Sources</h2>

              {/* Upload Zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = ACCENT; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = BORDER; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = BORDER; handleFiles(Array.from(e.dataTransfer.files)); }}
                style={{
                  border: `2px dashed ${BORDER}`, borderRadius: 16, padding: "40px 20px",
                  textAlign: "center", cursor: "pointer", transition: "border-color 0.2s",
                  background: `${BG_SURFACE}80`, marginBottom: 20
                }}
              >
                <UploadIcon size={36} color={TEXT_DIM}/>
                <p style={{ fontSize: 15, fontWeight: 500, margin: "12px 0 4px" }}>Drop files here or click to upload</p>
                <p style={{ fontSize: 13, color: TEXT_DIM, margin: 0 }}>Excel (.xlsx), CSV, TSV, or text files</p>
                <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf" style={{ display: "none" }}
                  onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
                />
              </div>

              {/* DataConnection — T-S0.4 */}
              <DataConnection runScan={runScan} scanning={scanning} />

              <div style={{
                background: '#1a1a2e', border: '1px solid #3a3a5c',
                borderRadius: 8, padding: 20, marginTop: 24
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16,
                  color: '#e2e8f0' }}>Scan Schedule</div>
                {['operational', 'revenue'].map(type => (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{ color: '#a0aec0', fontSize: 13, marginBottom: 8,
                      textTransform: 'capitalize' }}>
                      {type === 'revenue' ? 'Revenue Intelligence' : 'Operational Scan'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['manual', 'daily', 'weekly', 'monthly'].map(freq => (
                        <button
                          key={freq}
                          onClick={() => updateScanSchedule(type, freq)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: scanSchedule[type] === freq
                              ? '1px solid #805ad5' : '1px solid #3a3a5c',
                            background: scanSchedule[type] === freq
                              ? '#553c9a' : 'transparent',
                            color: scanSchedule[type] === freq ? '#fff' : '#a0aec0',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: scanSchedule[type] === freq ? 600 : 400,
                            textTransform: 'capitalize'
                          }}
                        >{freq}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} />

            <Route
                path="/situation/:id/step/:n"
                element={<StepRouter priorities={situationAssessment?.assessment?.priorities || []} />}
              />
          </Routes>
          </ShellFrame>
        </main>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════
const inputStyle = {
  width: "100%", padding: "10px 14px", background: BG_SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: 10, color: TEXT, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
  boxSizing: "border-box"
};
const btnPrimary = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
  padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif",
  transition: "opacity 0.2s"
};
const btnSmall = {
  background: BG_SURFACE, color: TEXT_DIM, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif"
};
const labelStyle = { display: "block", marginBottom: 12 };
const labelText = { fontSize: 12, color: TEXT_DIM, display: "block", marginBottom: 4 };

function StepRouter({ priorities }) {
  const { id, n } = useParams();
  const matched = priorities.find(p => String(p.rank) === String(id));
  if (n === '1' && matched) {
    return <OpeningMoment priority={matched} />;
  }
  return <div style={{ padding: 16, color: '#E2E8F0' }}>Situation step — coming soon.</div>;
}
