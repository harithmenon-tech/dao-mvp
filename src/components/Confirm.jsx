// Confirm — T-S4.1 — Step 4 "Confirm" view
// Decision summary + owner + review date + accurate status wording.
// Writes to journal via onConfirm prop.
import { useState } from 'react';
// ─── Design tokens (match existing shell) ──────────────────────────────────
const BG_CARD  = '#111827';
const BORDER   = '#1E3A5F';
const ACCENT   = '#0EA5E9';
const TEXT     = '#E2E8F0';
const TEXT_DIM = '#94A3B8';
const GREEN    = '#10B981';
const AMBER    = '#F59E0B';
const RED      = '#EF4444';
// ─── Risk colour (matches OptionCards) ────────────────────────────────────
function riskColor(level) {
  switch ((level || '').toUpperCase()) {
    case 'LOW':    return GREEN;
    case 'MEDIUM': return AMBER;
    case 'HIGH':   return RED;
    default:       return TEXT_DIM;
  }
}
// ─── Status wording rule ──────────────────────────────────────────────────
function statusWording(riskLevel) {
  switch ((riskLevel || '').toUpperCase()) {
    case 'HIGH':   return 'Monitoring activated';
    case 'MEDIUM': return 'Flagged for Finance';
    default:       return 'Logged for Operations';
  }
}
// ─── today + 30 days as YYYY-MM-DD ────────────────────────────────────────
function defaultReviewDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}
// ─── Component ────────────────────────────────────────────────────────────
export default function Confirm({ selectedOption, situationSummary, onConfirm }) {
  const [owner, setOwner]           = useState('');
  const [reviewDate, setReviewDate] = useState(defaultReviewDate());
  const [submitted, setSubmitted]   = useState(false);
  // Guard: no option selected
  if (!selectedOption) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
          CONFIRM
        </div>
        <div style={{
          background: BG_CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.5 }}>
            No option selected. Return to the previous step and choose an option.
          </div>
        </div>
      </div>
    );
  }
  const rc     = riskColor(selectedOption.risk_level);
  const status = statusWording(selectedOption.risk_level);
  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    const entry = {
      id:              `DEC-${Date.now().toString(36).toUpperCase()}`,
      date:            new Date().toISOString().split('T')[0],
      statement:       selectedOption.label,
      tier:            1,
      type:            '',
      evidence:        situationSummary || '',
      assumptions:     selectedOption.rationale || '',
      confidence:      selectedOption.confidence || '',
      expected:        selectedOption.estimated_cost || '',
      owner:           owner,
      review_date:     reviewDate,
      decidedBy:       '',
      status:          'Confirmed',
      actualOutcome:   '',
      learning:        '',
      rationale:       selectedOption.rationale || '',
      context:         situationSummary || '',
      challenge_flags: [],
      confidenceScore: 3,
      tags:            [],
      lifecycleStatus: 'Active',
    };
    onConfirm(entry);
  };
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
        CONFIRM
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 24 }}>
        Confirm your decision
      </div>
      {/* Decision summary card */}
      <div style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 6 }}>
          DECISION
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 14 }}>
          {selectedOption.label}
        </div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
              ESTIMATED COST
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              {selectedOption.estimated_cost}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
              RISK
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: rc }}>
              {selectedOption.risk_level}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
              CONFIDENCE
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              {selectedOption.confidence}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
          {selectedOption.rationale}
        </div>
      </div>
      {/* Status wording */}
      <div style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM }}>
          STATUS
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>
          {status}
        </div>
      </div>
      {/* Owner field */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, display: 'block', marginBottom: 6 }}>
          DECISION OWNER
        </label>
        <input
          type="text"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          placeholder="Enter name or role"
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
      {/* Review date field */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, display: 'block', marginBottom: 6 }}>
          REVIEW DATE
        </label>
        <input
          type="date"
          value={reviewDate}
          onChange={e => setReviewDate(e.target.value)}
          style={{
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: TEXT,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </div>
      {/* Confirm button */}
      <button
        onClick={handleSubmit}
        disabled={submitted}
        style={{
          background: ACCENT,
          color: '#0B1120',
          border: 'none',
          borderRadius: 8,
          padding: '12px 28px',
          fontSize: 14,
          fontWeight: 700,
          cursor: submitted ? 'not-allowed' : 'pointer',
          opacity: submitted ? 0.6 : 1,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {submitted ? 'Confirmed' : 'Confirm decision'}
      </button>
    </div>
  );
}
