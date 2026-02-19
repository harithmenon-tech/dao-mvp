import { useState, useEffect } from "react";

// ── Design tokens matching App.jsx ──────────────────────────────
const ACCENT    = "#0EA5E9";
const BG_DARK   = "#0B1120";
const BG_CARD   = "#111827";
const BG_SURFACE= "#1E293B";
const BORDER    = "#1E3A5F";
const TEXT      = "#E2E8F0";
const TEXT_DIM  = "#94A3B8";
const GREEN     = "#10B981";
const AMBER     = "#F59E0B";
const RED       = "#EF4444";

// ── Replicate the same non-streaming fetch the app uses ─────────
async function callBriefAPI(systemPrompt, userMessage) {
  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      stream: false,
    }),
  });
  if (!resp.ok) {
    let msg;
    try { msg = (await resp.json()).error; } catch { msg = null; }
    throw new Error(msg || `API error (${resp.status})`);
  }
  const data = await resp.json();
  return data.text || "";
}

// ── System prompt that demands JSON-only output ─────────────────
const BRIEF_SYSTEM = `You are an executive decision intelligence system.
Return ONLY valid JSON — no markdown fences, no preamble, no trailing text.
Schema:
{
  "situation": "<1-line summary of what is happening>",
  "risks": [
    {"text":"<risk description>","confidence":"High|Medium|Low","evidence":"<brief supporting evidence>"},
    {"text":"...","confidence":"...","evidence":"..."},
    {"text":"...","confidence":"...","evidence":"..."}
  ],
  "opportunities": [
    {"text":"<opportunity description>","confidence":"High|Medium|Low","evidence":"<brief supporting evidence>"},
    {"text":"...","confidence":"...","evidence":"..."},
    {"text":"...","confidence":"...","evidence":"..."}
  ],
  "decisions_needed": [
    {"text":"<decision that must be made>"},
    {"text":"<second decision if needed>"}
  ]
}
Produce exactly 3 risks, exactly 3 opportunities, and 1–2 decisions_needed.`;

// ── Confidence badge colour ──────────────────────────────────────
function confidenceColor(c) {
  if (!c) return TEXT_DIM;
  const l = c.toLowerCase();
  if (l === "high")   return GREEN;
  if (l === "medium") return AMBER;
  return RED;
}

// ── A single risk or opportunity card ───────────────────────────
function InsightCard({ item, borderColor }) {
  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${borderColor}40`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.5, flex: 1 }}>{item.text}</p>
        <span style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 700,
          padding: "2px 10px", borderRadius: 20,
          background: `${confidenceColor(item.confidence)}20`,
          color: confidenceColor(item.confidence),
        }}>{item.confidence || "—"}</span>
      </div>
      {item.evidence && (
        <p style={{ margin: 0, fontSize: 12, color: TEXT_DIM, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: TEXT_DIM }}>Evidence: </span>{item.evidence}
        </p>
      )}
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────
function SectionHead({ label, color }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
      color: color || TEXT_DIM,
      margin: "20px 0 10px",
    }}>{label}</div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function BriefView({ profile, onBack, onChat }) {
  const [status, setStatus]   = useState("loading"); // loading | done | error
  const [brief, setBrief]     = useState(null);
  const [rawText, setRawText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchBrief() {
      // 1. Read localStorage
      let journal = [];
      let scan    = null;
      try {
        const jRaw = localStorage.getItem("dao-journal");
        if (jRaw) journal = JSON.parse(jRaw);
      } catch { journal = []; }
      try {
        const sRaw = localStorage.getItem("dao-scan");
        if (sRaw) scan = JSON.parse(sRaw);
      } catch { scan = null; }

      // 2. Build user message — last 5 journal entries + scan summary
      const journalLines = journal.slice(0, 5).map((j, i) =>
        `[${i + 1}] ${j.date || "?"} — ${j.statement} | Tier:${j.tier ?? "?"} | Status:${j.status ?? "?"}`
      );
      const journalBlock = journalLines.length
        ? `RECENT DECISIONS (last ${journalLines.length}):\n${journalLines.join("\n")}`
        : "RECENT DECISIONS: none logged yet.";

      const scanBlock = scan?.text
        ? `ENTERPRISE SCAN SUMMARY:\n${scan.text.slice(0, 1200)}`
        : "ENTERPRISE SCAN: no scan data available.";

      const orgLine = profile
        ? `Organisation: ${profile.org} | Industry: ${profile.industry} | Region: ${profile.region || "—"}`
        : "";

      const userMessage = `${orgLine}\n\n${journalBlock}\n\n${scanBlock}\n\nGenerate the executive brief JSON.`;

      // 3. Call the API
      try {
        const raw = await callBriefAPI(BRIEF_SYSTEM, userMessage);
        setRawText(raw);

        // 4. Parse JSON — strip markdown fences if present
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/g, "").trim();
        const parsed  = JSON.parse(cleaned);
        setBrief(parsed);
        setStatus("done");
      } catch (err) {
        setErrorMsg(err.message || "Unknown error");
        setStatus("error");
      }
    }

    fetchBrief();
  }, []); // single call on mount

  // ── Loading state ────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: BG_DARK, padding: 32, gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: `3px solid ${BORDER}`, borderTopColor: ACCENT,
          animation: "spin 0.8s linear infinite",
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: TEXT_DIM, fontSize: 14, margin: 0 }}>Generating your executive brief…</p>
      </div>
    );
  }

  // ── Error state (show raw text if available) ─────────────────
  if (status === "error") {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 16, background: BG_DARK }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <div style={{ background: `${RED}10`, border: `1px solid ${RED}40`, borderRadius: 12, padding: 16, marginTop: 16 }}>
          <p style={{ color: RED, fontWeight: 600, margin: "0 0 8px" }}>Could not parse brief</p>
          <p style={{ color: TEXT_DIM, fontSize: 12, margin: "0 0 12px" }}>{errorMsg}</p>
          {rawText && (
            <pre style={{
              color: TEXT_DIM, fontSize: 12, whiteSpace: "pre-wrap",
              background: BG_CARD, borderRadius: 8, padding: 12, margin: 0,
            }}>{rawText}</pre>
          )}
        </div>
      </div>
    );
  }

  // ── Done — render brief ──────────────────────────────────────
  const risks       = Array.isArray(brief?.risks)            ? brief.risks.slice(0, 3)        : [];
  const opps        = Array.isArray(brief?.opportunities)    ? brief.opportunities.slice(0, 3) : [];
  const decisions   = Array.isArray(brief?.decisions_needed) ? brief.decisions_needed.slice(0, 2) : [];
  const situation   = brief?.situation || "";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16, background: BG_DARK }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onChat} style={btnAction}>Discuss with AI →</button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: ACCENT, marginBottom: 6 }}>
        EXECUTIVE BRIEF
      </div>

      {/* Situation */}
      <div style={{
        background: BG_CARD, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: "14px 16px", marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, marginBottom: 6, letterSpacing: 1 }}>SITUATION</div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT, lineHeight: 1.5 }}>{situation}</p>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <>
          <SectionHead label="RISKS" color={RED} />
          {risks.map((r, i) => <InsightCard key={i} item={r} borderColor={RED} />)}
        </>
      )}

      {/* Opportunities */}
      {opps.length > 0 && (
        <>
          <SectionHead label="OPPORTUNITIES" color={GREEN} />
          {opps.map((o, i) => <InsightCard key={i} item={o} borderColor={GREEN} />)}
        </>
      )}

      {/* Decisions needed */}
      {decisions.length > 0 && (
        <>
          <SectionHead label="DECISIONS NEEDED" color={AMBER} />
          {decisions.map((d, i) => (
            <div key={i} style={{
              background: BG_CARD,
              border: `1px solid ${AMBER}40`,
              borderLeft: `3px solid ${AMBER}`,
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 10,
            }}>
              <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{d.text}</p>
            </div>
          ))}
        </>
      )}

      {/* Bottom CTA */}
      <div style={{ display: "flex", gap: 10, marginTop: 24, marginBottom: 8 }}>
        <button onClick={onChat} style={{ ...btnAction, flex: 1, justifyContent: "center" }}>
          Discuss with AI →
        </button>
        <button onClick={onBack} style={{ ...btnBackFull }}>
          ← Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Local button styles (no shared module available) ─────────────
const btnBack = {
  background: "none", border: "none", color: TEXT_DIM,
  fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif",
};
const btnAction = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
  padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif",
};
const btnBackFull = {
  background: BG_SURFACE, color: TEXT_DIM, border: `1px solid ${BORDER}`,
  borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
};
