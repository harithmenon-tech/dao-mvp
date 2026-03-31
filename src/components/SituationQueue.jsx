/**
 * SituationQueue — T-S0.5
 * Ranked situation cards with severity badges and static urgency indicators.
 *
 * Props:
 *   priorities  {Array}  — assessment.priorities from /api/situation response.
 *                          Each item: { rank, title, severity, insight, action, timeframe }
 *
 * Render rules:
 *   - Returns null when priorities.length < 2 (0 or 1 situation)
 *   - Renders ranked cards when priorities.length >= 2
 *
 * Navigation:
 *   - Single-tap routes to /situation/{priority.rank}/step/1
 *   - priority.rank is a temporary ordinal token only (1, 2, 3)
 *     — no stable identity, no persistence claim
 *
 * Visual note:
 *   - Mini bar indicator is a STATIC urgency indicator derived from timeframe.
 *     It is NOT a sparkline and carries no historical trend data.
 */

import { useNavigate } from 'react-router-dom';

// ── Design tokens (match App.jsx / ShellFrame conventions) ───────────────────
const BG_DARK    = '#0B1120';
const BG_CARD    = '#111827';
const BG_SURFACE = '#1E293B';
const BORDER     = '#1E3A5F';
const ACCENT     = '#0EA5E9';
const TEXT       = '#E2E8F0';
const TEXT_DIM   = '#94A3B8';
const RED        = '#EF4444';
const AMBER      = '#F59E0B';
const GREEN      = '#10B981';

// ── Severity → colour ────────────────────────────────────────────────────────
function severityColor(severity) {
  switch ((severity || '').toUpperCase()) {
    case 'HIGH':   return RED;
    case 'MEDIUM': return AMBER;
    case 'LOW':    return GREEN;
    default:       return TEXT_DIM;
  }
}

// ── Static urgency indicator ─────────────────────────────────────────────────
// Three bars. Bar count and colour derived from timeframe only.
// NOT a sparkline — carries no trend or historical data.
function UrgencyIndicator({ timeframe }) {
  const t = (timeframe || '').toLowerCase();
  let filled, color;
  if (t === 'immediate') {
    filled = 3; color = RED;
  } else if (t === 'this week') {
    filled = 2; color = AMBER;
  } else {
    filled = 1; color = GREEN;
  }

  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <rect
          key={i}
          x={i * 10}
          y={i < filled ? 0 : 4}
          width={8}
          height={i < filled ? 16 : 12}
          rx={2}
          fill={i < filled ? color : BORDER}
          opacity={i < filled ? 1 : 0.5}
        />
      ))}
    </svg>
  );
}

// ── Priority card ─────────────────────────────────────────────────────────────
function PriorityCard({ priority, onTap }) {
  const sevColor = severityColor(priority.severity);

  return (
    <div
      onClick={() => onTap(priority.rank)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onTap(priority.rank); }}
      style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        outline: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.boxShadow   = `0 0 0 1px ${ACCENT}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.boxShadow   = 'none';
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.boxShadow   = `0 0 0 1px ${ACCENT}`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.boxShadow   = 'none';
      }}
    >
      {/* ── Top row: rank + severity badge + urgency indicator ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: ACCENT,
          background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}40`,
          borderRadius: 6,
          padding: '2px 8px',
          flexShrink: 0,
        }}>
          #{priority.rank}
        </span>

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
          flexShrink: 0,
        }}>
          {priority.severity}
        </span>

        <div style={{ flex: 1 }} />

        <UrgencyIndicator timeframe={priority.timeframe} />

        <span style={{
          fontSize: 11,
          color: TEXT_DIM,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {priority.timeframe}
        </span>
      </div>

      {/* ── Title ── */}
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: TEXT,
        lineHeight: 1.3,
      }}>
        {priority.title}
      </div>

      {/* ── Insight ── */}
      <div style={{
        fontSize: 13,
        color: TEXT_DIM,
        lineHeight: 1.5,
      }}>
        {priority.insight}
      </div>

      {/* ── Enter cue ── */}
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: ACCENT,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
      }}>
        Review situation
        <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
      </div>
    </div>
  );
}

// ── SituationQueue ────────────────────────────────────────────────────────────
export default function SituationQueue({ priorities }) {
  const navigate = useNavigate();

  if (!Array.isArray(priorities) || priorities.length < 2) {
    return null;
  }

  const ranked = [...priorities].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  function handleTap(rank) {
    // Navigates using rank as a temporary ordinal token only.
    // This is NOT a stable situation identity — placeholder routing for T-S0.5.
    navigate(`/situation/${rank}/step/1`);
  }

  return (
    <div style={{
      minHeight: '100%',
      background: BG_DARK,
      padding: '24px 20px',
      boxSizing: 'border-box',
    }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: ACCENT,
        }}>
          Situation Queue
        </p>
        <h2 style={{
          margin: '0 0 6px',
          fontSize: 22,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.25,
        }}>
          {ranked.length} active decisions under watch
        </h2>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: TEXT_DIM,
          lineHeight: 1.5,
        }}>
          Ranked by priority. Tap a situation to begin Step 1.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ranked.map(priority => (
          <PriorityCard
            key={priority.rank}
            priority={priority}
            onTap={handleTap}
          />
        ))}
      </div>
    </div>
  );
}
