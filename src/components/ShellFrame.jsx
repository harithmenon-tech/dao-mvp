import { useLocation, useNavigate } from "react-router-dom";
import Toast from './Toast.jsx';
import DAOChief from './DAOChief.jsx';

// ─── T-S0.2 local constants ───────────────────────────────────────────────────
const TOTAL_STEPS = 7;

const STEP_LABELS = {
  1: "Opening Moment",
  2: "Understand",
  3: "Decide",
  4: "Confirm",
  5: "Monitor",
  6: "Review",
  7: "Board Report",
};

// Strict regex — must match /situation/<id>/step/<n> exactly
const STEP_ROUTE_RE = /^\/situation\/([^/]+)\/step\/(\d+)$/;

// ─── ShellFrame ───────────────────────────────────────────────────────────────
export default function ShellFrame({
  children,
  domainLabel,
  situationTitle,
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
  situationSummary,
  selectedOption,
  toastVisible = false,
  toastMessage = '',
  onToastDismiss,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const match = STEP_ROUTE_RE.exec(pathname);
  const situationId = match ? match[1] : null;
  const isStepRoute = Boolean(match);

  // Parse step number only on step routes
  const currentStep = isStepRoute ? parseInt(match[2], 10) : null;

  // Clamp to valid range so invalid values never break layout
  const safeStep =
    currentStep !== null
      ? Math.max(1, Math.min(currentStep, TOTAL_STEPS))
      : null;

  const progressPercent =
    safeStep !== null
      ? Math.round((safeStep / TOTAL_STEPS) * 100)
      : 0;

  const stepLabel = safeStep !== null ? (STEP_LABELS[safeStep] ?? `Step ${safeStep}`) : null;

  // ── Styles (inline; tokens consumed via CSS var fallbacks) ────────────────
  const stripStyle = {
    height: "var(--shell-strip-height, 52px)",
    minHeight: "var(--shell-strip-height, 52px)",
    background: "var(--color-bg-card, #111827)",
    borderBottom: "1px solid var(--color-border, #1E3A5F)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 16px",
    boxSizing: "border-box",
    flexShrink: 0,
  };

  const topRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  };

  const domainLabelStyle = {
    fontSize: "var(--shell-font-domain, 11px)",
    fontWeight: "var(--shell-font-weight-label, 600)",
    letterSpacing: "0.08em",
    color: "var(--color-accent, #0EA5E9)",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const stepLabelStyle = {
    fontSize: "var(--shell-font-step, 12px)",
    fontWeight: 500,
    color: "var(--color-text-dim, #94A3B8)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const progressTrackStyle = {
    width: "100%",
    height: "var(--shell-progress-height, 3px)",
    background: "var(--shell-progress-track, #1E3A5F)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 6,
    flexShrink: 0,
  };

  const progressFillStyle = {
    height: "100%",
    width: `${progressPercent}%`,
    background: "var(--shell-progress-fill, #0EA5E9)",
    borderRadius: 2,
    transition: "width 0.3s ease",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
      {/* Context strip — always rendered at reserved height */}
      <div style={stripStyle}>
        <div style={topRowStyle}>
          {/* Domain label — always shown on the left */}
          <span style={domainLabelStyle}>{domainLabel}</span>

          {/* Step label — only on step routes */}
          {isStepRoute && stepLabel && (
            <span style={stepLabelStyle}>{stepLabel}</span>
          )}

          {/* Step counter — only on step routes */}
          {isStepRoute && safeStep !== null && (
            <span style={{
              fontSize: 11,
              color: "var(--color-text-dim, #94A3B8)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {safeStep} / {TOTAL_STEPS}
            </span>
          )}
                    {/* T-CF.5-P4 — Guided-flow recovery */}
          {isStepRoute && safeStep !== null && safeStep > 1 && situationId && (
            <button
              onClick={() => navigate('/situation/' + situationId + '/step/' + (safeStep - 1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-dim, #94A3B8)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                marginRight: 2,
              }}
            >
              ← Previous Step
            </button>
          )}
          {/* Overview recovery — visible on step routes only */}
          {isStepRoute && (
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-dim, #94A3B8)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              ← Overview
            </button>
          )}
        </div>

        {/* Progress bar — only on step routes */}
        {isStepRoute && (
          <div style={progressTrackStyle}>
            <div style={progressFillStyle} />
          </div>
        )}
      </div>

      {/* Children rendered unchanged below the shell strip */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {children}
      </div>
      <DAOChief
        apiStatus={apiStatus}
        parsedFindings={parsedFindings}
        resolvedFindings={resolvedFindings}
        scanMode={scanMode}
        activeDomain={activeDomain}
        scanResults={scanResults}
        revenueScanResults={revenueScanResults}
        handleChatFiles={handleChatFiles}
        generateMsgId={generateMsgId}
        detectDecisionInMessage={detectDecisionInMessage}
        handleLogDecisionFromChat={handleLogDecisionFromChat}
        currentStep={safeStep}
        currentStepLabel={safeStep ? (STEP_LABELS[safeStep] || `Step ${safeStep}`) : null}
        situationSummary={situationSummary}
        selectedOption={selectedOption}
      />
      <Toast
        message={toastMessage}
        type="success"
        visible={toastVisible}
        onDismiss={onToastDismiss}
      />
    </div>
  );
}
