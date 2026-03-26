// CausalChain — T-S2.1 — Step 2 "Understand" view
// Colour-coded sequential visual showing what is driving the situation.

// ─── Design tokens ───────────────────────────────────────────────────────────
const BG_DARK  = '#0B1120';
const BG_CARD  = '#111827';
const BORDER   = '#1E3A5F';
const ACCENT   = '#0EA5E9';
const TEXT     = '#E2E8F0';
const TEXT_DIM = '#94A3B8';
const RED      = '#EF4444';
const AMBER    = '#F59E0B';
const GREEN    = '#10B981';

// ─── Severity colour ─────────────────────────────────────────────────────────
function severityColor(severity) {
  switch ((severity || '').toUpperCase()) {
    case 'HIGH':   return RED;
    case 'MEDIUM': return AMBER;
    case 'LOW':    return GREEN;
    default:       return TEXT_DIM;
  }
}

// ─── Evidence grounding ──────────────────────────────────────────────────────
function findEvidence(priority, findings) {
  if (!findings || findings.length === 0) return null;
  const titleLower = (priority.title || '').toLowerCase();
  const match = findings.find(f =>
    f.rootCause && f.rootCause.toLowerCase().includes(titleLower)
  ) || findings.find(f =>
    f.pattern && f.pattern.toLowerCase().includes(titleLower)
  );
  return match ? match.evidence : null;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CausalChain({ priorities, findings, onNext, priorCase }) {
  if (!priorities || priorities.length === 0) {
    return (
      <div style={{ padding: 24, color: TEXT_DIM, fontSize: 14 }}>
        No situation data available.
      </div>
    );
  }

  const nodes = priorities.slice(0, 3);

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>

      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
        UNDERSTAND
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 24 }}>
        What is driving this situation
      </div>

      {/* Chain nodes */}
      {nodes.map((priority, index) => {
        const sevColor = severityColor(priority.severity);
        const evidence = findEvidence(priority, findings);
        const isLast = index === nodes.length - 1;

        return (
          <div key={priority.rank || index}>

            {/* Node card */}
            <div style={{
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              borderLeft: `4px solid ${sevColor}`,
              borderRadius: 12,
              padding: '16px 20px',
            }}>

              {/* Severity badge + timeframe */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  color: sevColor, background: `${sevColor}20`,
                  padding: '2px 8px', borderRadius: 4,
                }}>
                  {(priority.severity || 'MEDIUM').toUpperCase()}
                </span>
                {priority.timeframe && (
                  <span style={{ fontSize: 11, color: TEXT_DIM }}>
                    {priority.timeframe}
                  </span>
                )}
              </div>

              {/* Title */}
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
                {priority.title}
              </div>

              {/* Insight line */}
              <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5, marginBottom: evidence ? 10 : 0 }}>
                {priority.insight}
              </div>

              {/* Citation line — only rendered when evidence is matched */}
              {evidence && (
                <div style={{
                  fontSize: 12, color: TEXT_DIM,
                  background: `${BORDER}40`,
                  borderRadius: 6, padding: '6px 10px',
                  fontStyle: 'italic', lineHeight: 1.4,
                }}>
                  {evidence}
                </div>
              )}
            </div>

            {/* Directional connector — not rendered after last node */}
            {!isLast && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                  <line x1="10" y1="0" x2="10" y2="18" stroke={BORDER} strokeWidth="2"/>
                  <polyline points="4,14 10,22 16,14" stroke={BORDER} strokeWidth="2" fill="none" strokeLinejoin="round"/>
                </svg>
              </div>
            )}

          </div>
        );
      })}

      {/* Prior confirmed pattern reference — renders only when confirmed pattern exists */}
      {priorCase && (
        <div style={{
          marginTop: 24,
          background: '#111827',
          border: '1px solid #1E3A5F',
          borderRadius: 12,
          padding: '14px 18px',
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: '#94A3B8',
            marginBottom: 6,
          }}>
            FROM DECISION MEMORY
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#E2E8F0',
            marginBottom: 4,
          }}>
            {priorCase.label}
          </div>
          {priorCase.count > 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              Previously observed {priorCase.count} time{priorCase.count !== 1 ? 's' : ''} in this organisation
            </div>
          )}
        </div>
      )}
      {/* CTA */}
      <div style={{ marginTop: 32 }}>
        <button
          onClick={onNext}
          style={{
            background: ACCENT, color: '#fff', border: 'none',
            borderRadius: 10, padding: '12px 24px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          See my options →
        </button>
      </div>

    </div>
  );
}
