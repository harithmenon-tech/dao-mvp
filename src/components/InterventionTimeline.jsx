// InterventionTimeline — T-S5.2
// Reads dao-scan-history from localStorage.
// Filters to scans on or after the confirmed decision anchor date.
// Empty state: "No events since decision" — never blank.
export default function InterventionTimeline({ decisionDate }) {
  // ─── Read scan history ──────────────────────────────────────────
  let allRecords = [];
  try {
    const raw = localStorage.getItem('dao-scan-history');
    const parsed = JSON.parse(raw || '[]');
    allRecords = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    allRecords = [];
  }
  // ─── Filter: scans on or after decision anchor ──────────────────
  let events = [];
  if (decisionDate) {
    const anchor = new Date(decisionDate);
    anchor.setHours(0, 0, 0, 0);
    events = allRecords.filter((rec) => {
      try {
        const d = new Date(rec.date);
        if (isNaN(d.getTime())) return false;
        const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return dayOnly >= anchor;
      } catch (_) {
        return false;
      }
    });
    // Chronological: oldest first
    events.sort((a, b) => {
      try { return new Date(a.date) - new Date(b.date); }
      catch (_) { return 0; }
    });
  }
  // ─── Design tokens (match Step 5 shell) ─────────────────────────
  const BG_CARD  = '#111827';
  const BORDER   = '#1E3A5F';
  const TEXT     = '#E2E8F0';
  const TEXT_DIM = '#94A3B8';
  const ACCENT   = '#0EA5E9';
  // ─── Date formatter ──────────────────────────────────────────────
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) {
      return iso || '—';
    }
  }
  return (
    <div style={{ marginTop: '24px' }}>
      {/* Section label */}
      <p style={{
        margin: '0 0 12px',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: TEXT_DIM,
        textTransform: 'uppercase',
      }}>
        SCAN EVENTS SINCE DECISION
      </p>
      {/* Empty state */}
      {events.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '72px',
          fontSize: '14px',
          color: TEXT_DIM,
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
        }}>
          No events since decision
        </div>
      )}
      {/* Event rows */}
      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {events.map((rec, index) => {
            const safeKey = rec.id
              ? rec.id
              : `${rec.date || ''}-${rec.type || ''}-${index}`;
            const datasets = Array.isArray(rec.datasetsUsed) && rec.datasetsUsed.length > 0
              ? rec.datasetsUsed.join(', ')
              : null;
            const count = typeof rec.findingCount === 'number'
              ? `${rec.findingCount} finding${rec.findingCount === 1 ? '' : 's'}`
              : null;
            const type = rec.type
              ? rec.type.charAt(0).toUpperCase() + rec.type.slice(1)
              : null;
            return (
              <div key={safeKey} style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                    {type || 'Scan'}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_DIM }}>
                    {formatDate(rec.date)}
                  </span>
                </div>
                {datasets && (
                  <div style={{ marginTop: 6, fontSize: 12, color: TEXT_DIM }}>
                    {datasets}
                  </div>
                )}
                {count && (
                  <div style={{ marginTop: 4, fontSize: 12, color: TEXT }}>
                    {count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
