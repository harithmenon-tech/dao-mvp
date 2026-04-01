// Review — T-S6.1 — Step 6 "Review outcome" view
// Outcome selector (Exceeded / Met / Partial / Missed) + DAO suggestion
// pre-populated from /api/variance with UI-layer constitutional mapping.
// Writes via onSubmitReview prop — no direct localStorage access.
import { useState, useEffect } from 'react';
// ─── Design tokens (match shell) ─────────────────────────────────────────────
const BG_CARD  = '#111827';
const BORDER   = '#1E3A5F';
const ACCENT   = '#0EA5E9';
const TEXT     = '#E2E8F0';
const TEXT_DIM = '#94A3B8';
const GREEN    = '#10B981';
const AMBER    = '#F59E0B';
const RED      = '#EF4444';
// ─── Constitutional outcome options ──────────────────────────────────────────
const OUTCOMES = ['Exceeded', 'Met', 'Partial', 'Missed'];
const OUTCOME_COLOR = {
  Exceeded: GREEN,
  Met:      ACCENT,
  Partial:  AMBER,
  Missed:   RED,
};
// ─── Map /api/variance raw response → constitutional vocabulary ─────────────
// Called once on API response. Result stored as mappedSuggestion state.
// Never mutated by human interaction after being set.
function mapToConstitutional(raw) {
  if (raw === 'Better') return 'Exceeded';
  if (raw === 'Same')   return 'Met';
  if (raw === 'Worse')  return 'Partial'; // default negative suggestion only per CTO ruling
  return null;
}
// ─── Status wording (matches Confirm.jsx) ────────────────────────────────────
function statusWording(riskLevel) {
  switch ((riskLevel || '').toUpperCase()) {
    case 'HIGH':   return 'Monitoring activated';
    case 'MEDIUM': return 'Flagged for Finance';
    default:       return 'Logged for Operations';
  }
}
// ─── Component ───────────────────────────────────────────────────────────────
// Module-level in-flight guard — survives remount, cleared on request completion/failure.
// Key: confirmed entry id. Prevents duplicate /api/variance calls caused by remount
// churn while a request is already active for this decision entry.
const _varianceInFlight = new Set();

export default function Review({
  journal,
  situationSummary,
  selectedOption,
  activeDomain,
  onSubmitReview,
}) {
  // ── Locate the single target entry: last journal entry with status === 'Confirmed' ──
  // Reverses a copy of the array so the most recent Confirmed entry is found first.
  // All earlier Confirmed entries are left untouched.
  const entry = [...(journal || [])]
    .reverse()
    .find(e => e.status === 'Confirmed') || null;
  // ── DAO suggestion state ───────────────────────────────────────────────────
  const [daoLoading, setDaoLoading]             = useState(false);
  const [daoVariance, setDaoVariance]           = useState(null);  // raw API response object
  const [mappedSuggestion, setMappedSuggestion] = useState(null);  // constitutional string, fixed at response time
  // ── Human selection state ──────────────────────────────────────────────────
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [varianceField, setVarianceField]     = useState('');
  const [lessonField, setLessonField]         = useState('');
  const [submitted, setSubmitted]             = useState(false);
  // ── Fetch DAO suggestion on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!entry) return;
    const flightKey = `variance-${entry.id}`;
    if (_varianceInFlight.has(flightKey)) return;
    _varianceInFlight.add(flightKey);

    setDaoLoading(true);
    fetch('/api/variance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionTitle:       entry.statement || '',
        context:             entry.context || entry.evidence || '',
        rationale:           entry.rationale || entry.assumptions || '',
        tier:                entry.tier || 1,
        reviewNotes:         '',
        uploadedDataSummary: '',
        activeDomain:        activeDomain || 'generic',
      }),
    })
      .then(r => r.json())
      .then(data => {
        setDaoVariance(data);
        const mapped = mapToConstitutional(data.variance);
        setMappedSuggestion(mapped);       // fixed at response time — never mutated after this point
        if (mapped && !selectedOutcome) {
          setSelectedOutcome(mapped);      // pre-select only if CEO has not yet made a choice
        }
      })
      .catch(() => {
        // API failure: suggestion silently omitted. Selector remains fully interactive.
      })
      .finally(() => {
        _varianceInFlight.delete(flightKey);
        setDaoLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (submitted) return;
    if (!selectedOutcome || !lessonField.trim()) return;
    setSubmitted(true);
    // humanOverrode: compare final human outcome against the mapped DAO suggestion.
    // null if no suggestion was available — no override to measure.
    const humanOverrode =
      mappedSuggestion !== null
        ? selectedOutcome !== mappedSuggestion
        : null;
    const reviewEntry = {
      id:                  `REV-${Date.now().toString(36).toUpperCase()}`,
      reviewed_at:         new Date().toISOString(),
      outcome:             selectedOutcome,               // final human constitutional choice
      variance:            varianceField || '',
      lesson:              lessonField.trim(),
      daoSuggestionRaw:    daoVariance?.variance || null,      // "Better"|"Same"|"Worse" — raw API value
      daoSuggestionMapped: mappedSuggestion || null,           // "Exceeded"|"Met"|"Partial" — constitutional mapping, fixed at response time
      humanOverrode:       humanOverrode,                      // computed against mappedSuggestion, not outcome
      daoConfidence:       daoVariance?.confidence || null,
      daoReasoning:        daoVariance?.reasoning || null,
    };
    onSubmitReview(reviewEntry);
  };
  // ── Guard: no confirmed entry found ───────────────────────────────────────
  if (!entry) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
          REVIEW & ASSIGN ACCOUNTABILITY
        </div>
        <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.5 }}>
            No confirmed decision found. Return to the previous step.
          </div>
        </div>
      </div>
    );
  }
  const canSubmit = !!selectedOutcome && lessonField.trim().length > 0;
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
        REVIEW & ASSIGN ACCOUNTABILITY
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 24 }}>
        Review DAO Discoveries and Assign Owner
      </div>
      {/* ── Decision context summary (read-only) ── */}
      <div style={{
        background: BG_CARD, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '18px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 6 }}>
          DECISION
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
          {entry.statement}
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {entry.owner && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>OWNER</div>
              <div style={{ fontSize: 13, color: TEXT }}>{entry.owner}</div>
            </div>
          )}
          {entry.review_date && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>REVIEW DATE</div>
              <div style={{ fontSize: 13, color: TEXT }}>{entry.review_date}</div>
            </div>
          )}
          {selectedOption?.risk_level && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>STATUS</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>
                {statusWording(selectedOption.risk_level)}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* ── DAO suggestion chip ── */}
      <div style={{ marginBottom: 16, minHeight: 36 }}>
        {daoLoading && (
          <div style={{ fontSize: 12, color: TEXT_DIM, fontStyle: 'italic' }}>
            DAO is assessing outcome…
          </div>
        )}
        {!daoLoading && daoVariance && mappedSuggestion && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `${ACCENT}12`, border: `1px solid ${ACCENT}30`,
            borderRadius: 8, padding: '8px 14px',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM }}>
              DAO SUGGESTS
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: OUTCOME_COLOR[mappedSuggestion] || ACCENT }}>
              {mappedSuggestion}
            </span>
            {daoVariance.confidence && (
              <span style={{ fontSize: 11, color: TEXT_DIM }}>
                · {daoVariance.confidence} confidence
              </span>
            )}
          </div>
        )}
        {!daoLoading && daoVariance?.reasoning && (
          <div style={{ marginTop: 6, fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
            {daoVariance.reasoning}
          </div>
        )}
      </div>
      {/* ── Outcome selector — constitutional vocabulary only ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 12 }}>
          OUTCOME
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {OUTCOMES.map(o => {
            const active = selectedOutcome === o;
            const col    = OUTCOME_COLOR[o];
            return (
              <button
                key={o}
                onClick={() => setSelectedOutcome(o)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: `1.5px solid ${active ? col : BORDER}`,
                  background: active ? `${col}18` : BG_CARD,
                  color: active ? col : TEXT_DIM,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
      {/* ── Variance field (CEO-entered, optional) ── */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, display: 'block', marginBottom: 6 }}>
          VARIANCE VS EXPECTED (OPTIONAL)
        </label>
        <input
          type="text"
          value={varianceField}
          onChange={e => setVarianceField(e.target.value)}
          placeholder="e.g. +12% above forecast, or describe the gap"
          style={{
            width: '100%',
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: TEXT,
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* ── Lesson field (required) ── */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, display: 'block', marginBottom: 6 }}>
          LESSON *
        </label>
        <textarea
          value={lessonField}
          onChange={e => setLessonField(e.target.value)}
          placeholder="What would you do differently?"
          rows={3}
          style={{
            width: '100%',
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: TEXT,
            fontFamily: "'DM Sans', sans-serif",
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* ── Submit button ── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitted}
        style={{
          background: ACCENT,
          color: '#0B1120',
          border: 'none',
          borderRadius: 8,
          padding: '12px 28px',
          fontSize: 14,
          fontWeight: 700,
          cursor: canSubmit && !submitted ? 'pointer' : 'not-allowed',
          opacity: canSubmit && !submitted ? 1 : 0.4,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {submitted ? 'Accountability Assigned — Decision is Live' : 'Confirm Review and Assign Owner'}
      </button>
    </div>
  );
}
