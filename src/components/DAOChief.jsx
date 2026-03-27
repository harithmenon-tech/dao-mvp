import { useState, useEffect, useRef } from 'react';

// ─── Colour constants (exact values from App.jsx lines 32–42) ────────────────
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

// ─── Style constants (matching App.jsx definitions) ──────────────────────────
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

// ─── Inline SVG icon helpers (zero deps, matching App.jsx) ───────────────────
const Icon = ({ d, size = 20, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
const FileIcon = (p) => <Icon {...p} d={<><path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7z"/><polyline points="14,2 14,8 20,8"/></>}/>;
const SendIcon = (p) => <Icon {...p} d={<><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></>}/>;
const PaperclipIcon = (p) => <Icon {...p} d={<><path d="m21.44 11.05-9.19 9.19a6 6 0 01-8.49-8.49l8.57-8.57A4 4 0 1118 8.84l-8.59 8.57a2 2 0 01-2.83-2.83l8.49-8.48"/></>}/>;

// ─── Data utility (matching App.jsx classifyDataset + summarizeData) ──────────
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function DAOChief({
  apiStatus,
  parsedFindings,
  resolvedFindings,
  scanMode,
  activeDomain,
  scanResults,
  revenueScanResults,
  handleChatFiles,
  generateMsgId,
  detectDecisionInMessage,
  handleLogDecisionFromChat,
  currentStep = null,
  currentStepLabel = null,
  situationSummary = '',
  selectedOption = null,
}) {
  // ── Section D — Local state (preserve exact names from App.jsx) ──────────
  const [chatMsgs, setChatMsgs] = useState(
    JSON.parse(localStorage.getItem('dao-chief-history') || '[]')
  );
  const [streaming, setStreaming] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatFiles, setChatFiles] = useState([]);
  const [micState, setMicState] = useState('idle');
  const [isOpen, setIsOpen] = useState(false);

  // ── Section E — Refs ─────────────────────────────────────────────────────
  const chatEnd = useRef(null);
  const chatFileRef = useRef(null);

  // ── Section F — Effects ──────────────────────────────────────────────────
  // Effect 1a — store persistence (localStorage substitute for store.set)
  useEffect(() => {
    if (chatMsgs.length) localStorage.setItem('dao-chat', JSON.stringify(chatMsgs));
  }, [chatMsgs]);
  // Effect 1b — dao-chief-history persistence
  useEffect(() => {
    localStorage.setItem('dao-chief-history', JSON.stringify(chatMsgs));
  }, [chatMsgs]);
  // Effect 2 — auto-scroll
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, streaming]);

  // ── Section G — Handlers ─────────────────────────────────────────────────

  // Handler 1 — handleMic (exact logic from App.jsx lines 1676–1690)
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

  // Handler 2 — sendMessage (exact logic from App.jsx lines 1694–1760)
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
        dataSummary: localStorage.getItem('dao-uploaded-summary') || '',
        stepContext: currentStep ? { step: currentStep, stepLabel: currentStepLabel || null } : null,
        situationSummary: situationSummary ? situationSummary.trim().slice(0, 500) : null,
        selectedOption: selectedOption ? {
          label: selectedOption.label || '',
          rationale: selectedOption.rationale || '',
          risk_level: selectedOption.risk_level || ''
        } : null,
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

  // Handler 3 — retryChiefMessage (exact logic from App.jsx lines 1762–1799)
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
      dataSummary: localStorage.getItem('dao-uploaded-summary') || '',
      stepContext: currentStep ? { step: currentStep, stepLabel: currentStepLabel || null } : null,
      situationSummary: situationSummary ? situationSummary.trim().slice(0, 500) : null,
      selectedOption: selectedOption ? {
        label: selectedOption.label || '',
        rationale: selectedOption.rationale || '',
        risk_level: selectedOption.risk_level || ''
      } : null,
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
      const chiefText = chiefRaw.replace(/[-–—]*\s*\bConfidence[:\s]+(HIGH|MODERATE|LOW)\b[^\n]*/gi, '').trim();
      setChatMsgs([...snapshot, { role: 'assistant', content: chiefText, confidence: chiefConf, msgId: generateMsgId() }]);
    } catch (e) {
      setChatMsgs([...snapshot, { role: 'assistant', content: 'Something went wrong. Please try again.', confidence: null, failed: true, retryQuery, msgId: generateMsgId() }]);
    }
    setStreaming(false);
  };

  // Handler 4 — handleChipSend (converted from IIFE at App.jsx lines 2645–2686)
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
        dataSummary: localStorage.getItem('dao-uploaded-summary') || '',
        stepContext: currentStep ? { step: currentStep, stepLabel: currentStepLabel || null } : null,
        situationSummary: situationSummary ? situationSummary.trim().slice(0, 500) : null,
        selectedOption: selectedOption ? {
          label: selectedOption.label || '',
          rationale: selectedOption.rationale || '',
          risk_level: selectedOption.risk_level || ''
        } : null,
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

  // Safe fallback for datasets (not passed as prop; display-only in empty state)
  const datasets = [];

  // ── Section H — Return JSX ───────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", zIndex: 1000, bottom: 24, right: 24 }}>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: ACCENT,
            border: "none",
            cursor: "pointer",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 24px rgba(14,165,233,0.35)"
          }}
        >
          Chief
        </button>
      )}
      {isOpen && (
        <div style={{
          width: 380,
          maxHeight: 520,
          display: "flex",
          flexDirection: "column",
          background: BG_DARK,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)"
        }}>
          {/* Close row */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 10px 0", flexShrink: 0 }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: TEXT_DIM,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 8px",
                borderRadius: 6
              }}
              title="Close Chief"
            >
              ×
            </button>
          </div>

          {/* ── Extracted Chief panel JSX (App.jsx lines 2422–2775) ── */}

          {/* Chat sub-header: Chief Status + Clear History */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 16px", borderBottom: `1px solid ${BORDER}20`, flexShrink: 0 }}>
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
                    localStorage.removeItem('dao-chat');
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

          {/* Message list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>
            {chatMsgs.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
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
                    📋 Log to Journal
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
            <div style={{ padding: "8px 16px 0", display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
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
            return (
              <div style={{
                padding: "8px 16px 0",
                paddingBottom: '80px',
                display: "flex",
                gap: 8,
                overflowX: "auto",
                flexWrap: "nowrap",
                scrollbarWidth: "none",
                flexShrink: 0
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
            flexShrink: 0
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
      )}
    </div>
  );
}
