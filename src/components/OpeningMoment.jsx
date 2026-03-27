/**
 * OpeningMoment — T-S1.1
 * Step 1 hero card. Financial figure dominant. No tabs, sidebars, or secondary panels.
 *
 * Props:
 *   priority  {Object}  — one priority object from /api/situation assessment.priorities
 *                         Required fields: impactValue, impactLabel, title, timeframe, insight
 *
 * CTA note:
 *   "Understand this situation" button is visually present but inert at T-S1.1.
 *   Navigation wiring is deferred to T-S2.1.
 */
// ── Design tokens (match App.jsx / ShellFrame / SituationQueue conventions) ──
const BG_DARK    = '#0B1120';
const BG_CARD    = '#111827';
const BORDER     = '#1E3A5F';
const ACCENT     = '#0EA5E9';
const TEXT       = '#E2E8F0';
const TEXT_DIM   = '#94A3B8';
const RED        = '#EF4444';
const AMBER      = '#F59E0B';
const GREEN      = '#10B981';
function severityColor(severity) {
  switch ((severity || '').toUpperCase()) {
    case 'HIGH':   return RED;
    case 'MEDIUM': return AMBER;
    case 'LOW':    return GREEN;
    default:       return TEXT_DIM;
  }
}
export default function OpeningMoment({ priority, onNext }) {
  if (!priority) {
    return (
      <div style={{ padding: 24, color: TEXT_DIM, fontSize: 14 }}>
        No situation data available.
      </div>
    );
  }
  const sevColor = severityColor(priority.severity);
  return (
    <div style={{
      minHeight: '100%',
      background: BG_DARK,
      padding: '32px 24px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 0,
    }}>
      {/* ── Step label ── */}
      <p style={{
        margin: '0 0 8px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: ACCENT,
      }}>
        Opening Moment
      </p>
      {/* ── Situation title ── */}
      <h2 style={{
        margin: '0 0 28px',
        fontSize: 22,
        fontWeight: 700,
        color: TEXT,
        lineHeight: 1.25,
        maxWidth: 640,
      }}>
        {priority.title}
      </h2>
      {/* ── Hero financial figure card ── */}
      <div style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: '32px 36px',
        marginBottom: 28,
        width: '100%',
        maxWidth: 560,
        boxSizing: 'border-box',
      }}>
        {/* Dominant figure */}
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          marginBottom: 10,
        }}>
          {priority.impactValue || '—'}
        </div>
        {/* Impact label */}
        <div style={{
          fontSize: 14,
          fontWeight: 500,
          color: TEXT_DIM,
          marginBottom: 24,
        }}>
          {priority.impactLabel || ''}
        </div>
        {/* Divider */}
        <div style={{
          height: 1,
          background: BORDER,
          marginBottom: 20,
        }} />
        {/* Severity badge + timeframe row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: sevColor,
            background: `${sevColor}18`,
            border: `1px solid ${sevColor}40`,
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            {priority.severity}
          </span>
          <span style={{
            fontSize: 12,
            color: TEXT_DIM,
          }}>
            {priority.timeframe}
          </span>
        </div>
        {/* One-sentence insight */}
        <div style={{
          fontSize: 15,
          color: TEXT_DIM,
          lineHeight: 1.6,
        }}>
          {priority.insight}
        </div>
      </div>
      {/* ── CTA — inert at T-S1.1, navigation wired at T-S2.1 ── */}
      <button
        onClick={onNext}
        style={{
          background: ACCENT,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Understand this situation →
      </button>
    </div>
  );
}
