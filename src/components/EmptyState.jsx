/**
 * EmptyState — T-S0.6
 * Shown on /situations when priorities.length < 2.
 *
 * Props:
 *   dataConnected  {boolean}  — true when at least one dataset is connected
 *   onScan         {function} — called directly on button click
 */

// ── Design tokens (match App.jsx / SituationQueue conventions) ───────────────
const BG_DARK  = '#0B1120';
const TEXT     = '#E2E8F0';
const TEXT_DIM = '#94A3B8';
const ACCENT   = '#0EA5E9';

export default function EmptyState({ dataConnected, onScan }) {
  const heading = dataConnected
    ? 'Nothing to surface yet'
    : 'No operational data connected';

  const body = dataConnected
    ? 'Your data is connected. Run a scan to surface situations that need your attention.'
    : 'Connect a data source to start surfacing situations that need your attention.';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px 20px',
      background: BG_DARK,
      boxSizing: 'border-box',
      width: '100%',
      maxWidth: '100%',
      textAlign: 'center',
    }}>
      <h2 style={{
        margin: '0 0 12px',
        fontSize: 20,
        fontWeight: 600,
        color: TEXT,
        lineHeight: 1.3,
      }}>
        {heading}
      </h2>

      <p style={{
        margin: '0 0 28px',
        fontSize: 14,
        color: TEXT_DIM,
        lineHeight: 1.6,
        maxWidth: 320,
      }}>
        {body}
      </p>

      <button
        onClick={onScan}
        style={{
          padding: '10px 24px',
          background: ACCENT,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.01em',
        }}
      >
        Run scan now
      </button>
    </div>
  );
}
