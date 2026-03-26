// OptionCards — T-S3.2 — Step 3 "Decide" view
// Three structured option cards wired to /api/options.

import { useState, useEffect } from 'react';

// ─── Design tokens (match existing shell) ────────────────────────────────────
const BG_CARD  = '#111827';
const BORDER   = '#1E3A5F';
const ACCENT   = '#0EA5E9';
const TEXT     = '#E2E8F0';
const TEXT_DIM = '#94A3B8';
const GREEN    = '#10B981';
const AMBER    = '#F59E0B';
const RED      = '#EF4444';

// ─── Risk colour ─────────────────────────────────────────────────────────────
function riskColor(level) {
  switch ((level || '').toUpperCase()) {
    case 'LOW':    return GREEN;
    case 'MEDIUM': return AMBER;
    case 'HIGH':   return RED;
    default:       return TEXT_DIM;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OptionCards({ situationSummary, findings }) {
  const [options, setOptions]               = useState(null);
  const [recommendedIndex, setRecommended]  = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    if (!situationSummary || !findings || findings.length === 0) {
      setLoading(false);
      setError('Situation data is not available. Return to the previous step and try again.');
      return;
    }

    let cancelled = false;

    async function fetchOptions() {
      try {
        setLoading(true);
        setError(null);

        const body = {
          situationSummary,
          scanFindings: findings.map(f => ({
            pattern:   f.pattern   || '',
            evidence:  f.evidence  || '',
            impact:    f.impact    || '',
            tier:      f.tier      || '',
            rootCause: f.rootCause || '',
          })),
        };

        const res = await fetch('/api/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error('Server returned ' + res.status);
        }

        const data = await res.json();

        if (!Array.isArray(data.options) || data.options.length !== 3) {
          throw new Error('Response did not contain exactly 3 options.');
        }

        if (!cancelled) {
          setOptions(data.options);
          setRecommended(typeof data.recommended_index === 'number' ? data.recommended_index : 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Options could not be loaded. Return to the previous step and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOptions();
    return () => { cancelled = true; };
  }, [situationSummary, findings]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
          DECIDE
        </div>
        <div style={{ fontSize: 14, color: TEXT_DIM }}>
          Analysing your options…
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !options) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
          DECIDE
        </div>
        <div style={{
          background: BG_CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.5 }}>
            {error || 'Options could not be loaded. Return to the previous step and try again.'}
          </div>
        </div>
      </div>
    );
  }

  // ── Success — exactly 3 cards ──────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>

      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, marginBottom: 8 }}>
        DECIDE
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 24 }}>
        Your options
      </div>

      {/* Option cards */}
      {options.map((option, index) => {
        const isRecommended = index === recommendedIndex;
        const rc = riskColor(option.risk_level);

        return (
          <div
            key={index}
            style={{
              background: BG_CARD,
              border: `1px solid ${isRecommended ? ACCENT : BORDER}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 16,
              position: 'relative',
            }}
          >
            {/* Recommended badge */}
            {isRecommended && (
              <div style={{
                position: 'absolute', top: 16, right: 16,
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                color: ACCENT, background: `${ACCENT}20`,
                padding: '3px 10px', borderRadius: 4,
              }}>
                RECOMMENDED
              </div>
            )}

            {/* Label */}
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12, paddingRight: isRecommended ? 110 : 0 }}>
              {option.label}
            </div>

            {/* Fields row */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
                  ESTIMATED COST
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {option.estimated_cost}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
                  RISK
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: rc }}>
                  {option.risk_level}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_DIM, marginBottom: 2 }}>
                  CONFIDENCE
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {option.confidence}
                </div>
              </div>
            </div>

            {/* Rationale */}
            <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5, marginBottom: 16 }}>
              {option.rationale}
            </div>

            {/* Choose button — presentation only, T-S4.1 owns wiring */}
            <button
              disabled
              style={{
                background: isRecommended ? `${ACCENT}20` : 'transparent',
                color: isRecommended ? ACCENT : TEXT_DIM,
                border: `1px solid ${isRecommended ? ACCENT : BORDER}`,
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'not-allowed',
                opacity: 0.7,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Choose this option
            </button>

          </div>
        );
      })}

    </div>
  );
}
