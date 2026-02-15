import { useState, useEffect, useRef, useCallback } from "react";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

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

async function callClaudeSync(systemPrompt, messages) {
  if (DEMO_MODE) return mockAssistant(systemPrompt, messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const resp = await fetch("/api/claude", {
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
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".tsv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
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
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
            const headers = data.length > 0 ? Object.keys(data[0]) : [];
            sheets[sn] = { rows: data, headers, rowCount: data.length };
            totalRows += data.length;
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

function summarizeData(datasets) {
  let summary = "";
  datasets.forEach((ds, i) => {
    summary += `\n--- DATA SOURCE ${i + 1}: ${ds.name} ---\n`;
    if (ds.type === "csv") {
      summary += `Type: CSV | Rows: ${ds.rowCount} | Columns: ${ds.headers.join(", ")}\n`;
      const sample = ds.rows.slice(0, 15);
      summary += `Sample data:\n${JSON.stringify(sample, null, 1)}\n`;
    } else if (ds.type === "excel") {
      ds.sheetNames.forEach(sn => {
        const sh = ds.sheets[sn];
        summary += `Sheet "${sn}": ${sh.rowCount} rows | Columns: ${sh.headers.join(", ")}\n`;
        const sample = sh.rows.slice(0, 15);
        summary += `Sample:\n${JSON.stringify(sample, null, 1)}\n`;
      });
    } else {
      summary += `Type: Text | Length: ${ds.charCount} chars\n`;
      summary += ds.content.substring(0, 2000) + "\n";
    }
  });
  return summary;
}

// ═══════════════════════════════════════════════════════════════
// ICONS (inline SVG for zero deps)
// ═══════════════════════════════════════════════════════════════
const Icon = ({ d, size = 20, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
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

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("chat");
  const [sideOpen, setSideOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [journal, setJournal] = useState([]);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [ob, setOb] = useState({ name: "", org: "", industry: "", region: "asean", style: "" });
  const chatEnd = useRef(null);
  const fileRef = useRef(null);
  const chatFileRef = useRef(null);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [jf, setJf] = useState({ statement: "", tier: "2", type: "technical", evidence: "", assumptions: "", confidence: "moderate", expected: "", reviewDays: 30 });

  // API status: "checking" | "live" | "demo" | "error"
  const [apiStatus, setApiStatus] = useState("checking");
  // Files attached directly in chat
  const [chatFiles, setChatFiles] = useState([]);

  // Health check — determines if live API is available
  useEffect(() => {
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
  }, []);

  // Persist
  useEffect(() => { if (journal.length) store.set("dao-journal", journal); }, [journal]);
  useEffect(() => { if (chatMsgs.length) store.set("dao-chat", chatMsgs); }, [chatMsgs]);
  useEffect(() => { if (scanResults) store.set("dao-scan", scanResults); }, [scanResults]);
  useEffect(() => { if (datasets.length) store.set("dao-datasets-meta", datasets.map(d => ({ name: d.name, type: d.type, rowCount: d.totalRows || d.rowCount || 0 }))); }, [datasets]);

  // Auto-scroll chat
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, streaming]);

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
        newDatasets.push(parsed);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
    setDatasets(newDatasets);
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

  // ═══════════ ENTERPRISE SCAN ═══════════
  const runScan = async () => {
    if (datasets.length === 0) return;
    setScanning(true);
    setScanResults(null);
    setView("scan");
    try {
      const dataSummary = summarizeData(datasets);
      const sysPrompt = `${IDENTITY_PROMPT}\n\n${STYLE_PROMPTS[profile.style] || ""}\n\nCEO: ${profile.name} | Org: ${profile.org} | Industry: ${profile.industry}\n\n${SCAN_PROMPT}`;
      const result = await callClaudeSync(sysPrompt, [
        { role: "user", content: `Here is all the operational data from ${profile.org}. Run a full Enterprise Scan.\n\n${dataSummary}` }
      ]);
      setScanResults({ text: result, timestamp: new Date().toISOString() });
    } catch (e) {
      setScanResults({ text: `Error running scan: ${e.message}`, timestamp: new Date().toISOString(), error: true });
    }
    setScanning(false);
  };

  // ═══════════ CHAT ═══════════
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

    const newMsgs = [...chatMsgs, { role: "user", content: displayContent }];
    setChatMsgs(newMsgs);
    setChatFiles([]); // Clear attached files
    setStreaming(true);

    try {
      const sysPrompt = buildSystemPrompt();
      // Include all data context if available
      let contextMsg = fullContent;
      if (datasets.length > 0 && chatFiles.length === 0) {
        const dataSummary = summarizeData(datasets);
        contextMsg = `[CONNECTED DATA FOR REFERENCE]\n${dataSummary}\n\n[CEO'S QUESTION]\n${fullContent}`;
      }

      // Build message history (last 10 messages for context window)
      const history = newMsgs.slice(-10).map((m, idx) => ({
        role: m.role,
        content: m.role === "user" && idx === newMsgs.slice(-10).length - 1 ? contextMsg : m.content
      }));

      const streamMsgs = [...newMsgs, { role: "assistant", content: "" }];
      setChatMsgs(streamMsgs);

      await callClaude(sysPrompt, history, (partial) => {
        setChatMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: partial };
          return updated;
        });
      });
    } catch (e) {
      setChatMsgs(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === "assistant" && !updated[updated.length - 1].content) {
          updated[updated.length - 1] = { role: "assistant", content: `Error: ${e.message}` };
        } else {
          updated.push({ role: "assistant", content: `Error: ${e.message}` });
        }
        return updated;
      });
    }
    setStreaming(false);
  };

  // ═══════════ JOURNAL ═══════════
  const addJournalEntry = () => {
    const entry = {
      id: `DEC-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString().split("T")[0],
      statement: jf.statement,
      tier: jf.tier,
      type: jf.type,
      evidence: jf.evidence,
      assumptions: jf.assumptions,
      confidence: jf.confidence,
      expected: jf.expected,
      reviewDate: new Date(Date.now() + jf.reviewDays * 86400000).toISOString().split("T")[0],
      decidedBy: profile.name,
      status: "pending",
      actualOutcome: "",
      learning: ""
    };
    const updated = [entry, ...journal];
    setJournal(updated);
    setShowJournalForm(false);
    setJf({ statement: "", tier: "2", type: "technical", evidence: "", assumptions: "", confidence: "moderate", expected: "", reviewDays: 30 });
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
  };

  const navItems = [
    { id: "chat", label: "Chat", icon: ChatIcon },
    { id: "scan", label: "Scan", icon: ScanIcon },
    { id: "journal", label: "Journal", icon: BookIcon, badge: journal.length || null },
    { id: "data", label: "Data", icon: FileIcon, badge: datasets.length || null },
  ];

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
            <div style={{ fontSize: 11, color: TEXT_DIM }}>{profile.org} • {profile.industry}</div>
          </div>
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
              <button key={item.id} onClick={() => { setView(item.id); setSideOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px",
                background: view === item.id ? `${ACCENT}15` : "transparent",
                border: `1px solid ${view === item.id ? `${ACCENT}40` : "transparent"}`,
                borderRadius: 10, cursor: "pointer", color: view === item.id ? ACCENT : TEXT_DIM,
                marginBottom: 4, transition: "all 0.2s", fontSize: 14, fontWeight: 500
              }}>
                <item.icon size={18} color={view === item.id ? ACCENT : TEXT_DIM}/>
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
            <button onClick={resetAll} style={{ fontSize: 12, color: RED, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset Everything</button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ═══════ CHAT VIEW ═══════ */}
          {view === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
                  <div key={i} style={{
                    display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
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
                      {msg.content || (streaming && i === chatMsgs.length - 1 ? <span style={{ color: TEXT_DIM }}>Thinking...</span> : "")}
                    </div>
                  </div>
                ))}
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
                  <button onClick={sendMessage} disabled={streaming || (!chatInput.trim() && chatFiles.length === 0)} style={{ ...btnPrimary, padding: "10px 16px", opacity: (chatInput.trim() || chatFiles.length > 0) && !streaming ? 1 : 0.4, flexShrink: 0 }}>
                    <SendIcon size={18} color="#fff"/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ SCAN VIEW ═══════ */}
          {view === "scan" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {datasets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                  <ScanIcon size={48} color={TEXT_DIM}/>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT, margin: "16px 0 8px" }}>No Data Connected</h2>
                  <p style={{ fontSize: 14 }}>Upload Excel, CSV, or text files in the Data tab to run an Enterprise Scan.</p>
                  <button onClick={() => setView("data")} style={{ ...btnPrimary, marginTop: 16 }}>Go to Data</button>
                </div>
              ) : scanning ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 2s infinite" }}>&#128269;</div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Enterprise Scan Running</h2>
                  <p style={{ color: TEXT_DIM, fontSize: 14 }}>Analysing {datasets.length} data source(s) across 5 pattern categories...</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, margin: "24px auto 0", textAlign: "left" }}>
                    {["Sensemaking Engine", "Quick-Fix Patterns", "Governed Loop", "Confidence Intel", "Outcome Learning"].map((eng, i) => (
                      <div key={eng} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: TEXT_DIM }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: `pulse 1.5s infinite ${i * 0.3}s` }}/>
                        {eng}
                      </div>
                    ))}
                  </div>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
                </div>
              ) : scanResults ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Scan Results</h2>
                      <p style={{ color: TEXT_DIM, fontSize: 12, margin: "4px 0 0" }}>{new Date(scanResults.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={runScan} style={btnSmall}>Re-scan</button>
                  </div>
                  {scanResults.error && (
                    <div style={{ background: `${RED}15`, border: `1px solid ${RED}40`, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: RED }}>
                      Scan encountered an error. {apiStatus === "demo" ? "This is normal in demo mode — connect your API key for real scans." : "Check your API key and try again."}
                    </div>
                  )}
                  <div style={{ background: BG_CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>
                    {scanResults.text}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT, margin: "0 0 8px" }}>Ready to Scan</h2>
                  <p style={{ fontSize: 14 }}>{datasets.length} data source(s) connected.</p>
                  <button onClick={runScan} style={{ ...btnPrimary, marginTop: 16 }}>Run Enterprise Scan</button>
                </div>
              )}
            </div>
          )}

          {/* ═══════ JOURNAL VIEW ═══════ */}
          {view === "journal" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Decision Journal</h2>
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
                      <select value={jf.tier} onChange={e => setJf({...jf, tier: e.target.value})} style={inputStyle}>
                        <option value="1">Tier 1 — Low</option>
                        <option value="2">Tier 2 — Medium</option>
                        <option value="3">Tier 3 — High</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <span style={labelText}>Decision Type</span>
                      <select value={jf.type} onChange={e => setJf({...jf, type: e.target.value})} style={inputStyle}>
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
                      <span style={labelText}>Confidence</span>
                      <select value={jf.confidence} onChange={e => setJf({...jf, confidence: e.target.value})} style={inputStyle}>
                        <option value="high">HIGH</option>
                        <option value="moderate">MODERATE</option>
                        <option value="low">LOW</option>
                      </select>
                    </label>
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
                  <label style={labelStyle}>
                    <span style={labelText}>Expected Outcome</span>
                    <textarea value={jf.expected} onChange={e => setJf({...jf, expected: e.target.value})} placeholder="What should happen if this decision is correct..." rows={2} style={{...inputStyle, resize: "vertical"}}/>
                  </label>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={addJournalEntry} disabled={!jf.statement} style={{ ...btnPrimary, opacity: jf.statement ? 1 : 0.4 }}>Save to Journal</button>
                    <button onClick={() => setShowJournalForm(false)} style={btnSmall}>Cancel</button>
                  </div>
                </div>
              )}

              {journal.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                  <BookIcon size={48} color={TEXT_DIM}/>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: "16px 0 8px" }}>No Decisions Logged</h3>
                  <p style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>The Decision Journal is your institutional memory. Every decision logged here is permanent, governed, and trackable.</p>
                </div>
              ) : (
                journal.map((entry) => (
                  <div key={entry.id} style={{ background: BG_CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_DIM }}>{entry.id}</span>
                        <h4 style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 0" }}>{entry.statement}</h4>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                        background: entry.tier === "3" ? `${RED}20` : entry.tier === "2" ? `${AMBER}20` : `${GREEN}20`,
                        color: entry.tier === "3" ? RED : entry.tier === "2" ? AMBER : GREEN
                      }}>Tier {entry.tier}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: TEXT_DIM }}>
                      <span>{entry.date}</span>
                      <span>{entry.type}</span>
                      <span>{entry.confidence === "high" ? "HIGH" : entry.confidence === "moderate" ? "MODERATE" : "LOW"}</span>
                      <span>Review: {entry.reviewDate}</span>
                      <span style={{ color: entry.status === "resolved" ? GREEN : entry.status === "in_progress" ? AMBER : TEXT_DIM }}>
                        {entry.status}
                      </span>
                    </div>
                    {entry.evidence && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "8px 0 0", lineHeight: 1.5 }}><strong>Evidence:</strong> {entry.evidence}</p>}
                    {entry.assumptions && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "4px 0 0", lineHeight: 1.5 }}><strong>Assumptions:</strong> {entry.assumptions}</p>}
                    {entry.expected && <p style={{ fontSize: 13, color: TEXT_DIM, margin: "4px 0 0", lineHeight: 1.5 }}><strong>Expected:</strong> {entry.expected}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══════ DATA VIEW ═══════ */}
          {view === "data" && (
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

              {/* Connected Sources */}
              {datasets.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Connected ({datasets.length})</h3>
                    <button onClick={() => { setDatasets([]); store.del("dao-datasets-meta"); }} style={{ ...btnSmall, color: RED, borderColor: `${RED}40` }}>Clear All</button>
                  </div>
                  {datasets.map((ds, i) => (
                    <div key={i} style={{ background: BG_CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${GREEN}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileIcon size={20} color={GREEN}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{ds.name}</div>
                        <div style={{ fontSize: 12, color: TEXT_DIM }}>
                          {ds.type === "excel" ? `Excel • ${ds.sheetNames?.length || "?"} sheet(s) • ${ds.totalRows || "?"} rows` :
                           ds.type === "csv" ? `CSV • ${ds.rowCount || "?"} rows • ${ds.headers?.length || "?"} columns` :
                           `Text • ${(ds.charCount || 0).toLocaleString()} chars`}
                        </div>
                      </div>
                      <CheckIcon size={18} color={GREEN}/>
                    </div>
                  ))}
                  <button onClick={runScan} disabled={scanning} style={{ ...btnPrimary, width: "100%", marginTop: 16 }}>
                    {scanning ? "Scanning..." : "Run Enterprise Scan"}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM NAV */}
      <nav style={{
        position: "sticky", bottom: 0, background: BG_CARD, borderTop: `1px solid ${BORDER}`,
        display: view === "chat" ? "none" : "flex", justifyContent: "space-around", padding: "8px 0", zIndex: 30
      }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            background: "none", border: "none", cursor: "pointer", color: view === item.id ? ACCENT : TEXT_DIM,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 500, padding: "4px 12px"
          }}>
            <item.icon size={20} color={view === item.id ? ACCENT : TEXT_DIM}/>
            {item.label}
          </button>
        ))}
      </nav>
      {view === "chat" && (
        <nav style={{
          position: "fixed", bottom: 64, left: 0, right: 0,
          display: "flex", justifyContent: "center", gap: 4, padding: "0 16px", zIndex: 25
        }}>
          {navItems.filter(n => n.id !== "chat").map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{
              background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 20,
              cursor: "pointer", color: TEXT_DIM, display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 500, padding: "6px 12px"
            }}>
              <item.icon size={14} color={TEXT_DIM}/> {item.label}
              {item.badge && <span style={{ background: `${ACCENT}20`, color: ACCENT, borderRadius: 8, padding: "1px 6px", fontSize: 10 }}>{item.badge}</span>}
            </button>
          ))}
        </nav>
      )}
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
