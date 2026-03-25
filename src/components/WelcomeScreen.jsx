import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// WelcomeScreen — T-S0.3
// The CEO's first-impression landing screen.
// Props: situationCount (int), singleSituationId (string | null)
// No useState, no useEffect, no localStorage access.
// ═══════════════════════════════════════════════════════════════

export default function WelcomeScreen({ situationCount, singleSituationId }) {
  const navigate = useNavigate();

  // ── Tile 2 content derived entirely from props ───────────────
  let tile2Step, tile2Label, tile2Text, tile2Dest;
  if (situationCount >= 2) {
    tile2Step = 'Queue';
    tile2Label = 'See all situations';
    tile2Text = `${situationCount} active situations`;
    tile2Dest = '/situations';
  } else if (situationCount === 1) {
    tile2Step = 'Step 1';
    tile2Label = 'Opening Moment';
    tile2Text = '1 active situation';
    tile2Dest = singleSituationId
      ? `/situation/${singleSituationId}/step/1`
      : '/situations';
  } else {
    tile2Step = 'Step 1';
    tile2Label = 'Opening Moment';
    tile2Text = 'Begin your first situation';
    tile2Dest = '/situations';
  }

  // ── Informational tiles 3–8 (display-only) ──────────────────
  const infoTiles = [
    { step: 'Step 2', title: 'Understand',    text: 'Analyse the causal chain' },
    { step: 'Step 3', title: 'Decide',         text: 'Review your options'     },
    { step: 'Step 4', title: 'Confirm',        text: 'Log your decision'       },
    { step: 'Step 5', title: 'Monitor',        text: 'Track outcomes'          },
    { step: 'Step 6', title: 'Review',         text: 'Capture the lesson'      },
    { step: 'Step 7', title: 'Board Report',   text: 'Export for governance'   },
  ];

  return (
    <>
      {/* ── Responsive grid rules + hover transitions ─────────── */}
      <style>{`
        .ws-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4, 16px);
        }
        @media (max-width: 480px) {
          .ws-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .ws-tile-2 {
            grid-column: 1 / -1 !important;
          }
        }
        .ws-tile-clickable {
          cursor: pointer;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .ws-tile-clickable:hover {
          border-color: var(--color-accent, #0EA5E9) !important;
          box-shadow: 0 0 0 1px var(--color-accent, #0EA5E9);
        }
        .ws-tile-info {
          cursor: default;
          pointer-events: none;
        }
      `}</style>

      {/* ── Outer shell ─────────────────────────────────────────── */}
      <div
        style={{
          minHeight: '100%',
          background: 'var(--color-bg-dark, #0B1120)',
          padding: 'var(--space-8, 32px)',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <header
          style={{
            marginBottom: 'var(--space-8, 32px)',
            paddingBottom: 'var(--space-6, 24px)',
            borderBottom: '1px solid var(--color-border, #1E3A5F)',
          }}
        >
          <p
            style={{
              margin: '0 0 var(--space-2, 8px)',
              fontSize: 'var(--text-xs, 11px)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-accent, #0EA5E9)',
            }}
          >
            Decision Accountability OS
          </p>
          <h1
            style={{
              margin: '0 0 var(--space-3, 12px)',
              fontSize: 'var(--text-3xl, 30px)',
              fontWeight: 700,
              lineHeight: 'var(--line-tight, 1.25)',
              color: 'var(--color-text, #E2E8F0)',
            }}
          >
            Welcome back.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              lineHeight: 'var(--line-relaxed, 1.6)',
              color: 'var(--color-text-dim, #94A3B8)',
              maxWidth: '540px',
            }}
          >
            Surface truth. Force decisions. Make change stick.
          </p>
        </header>

        {/* ── 8-tile grid ───────────────────────────────────────── */}
        <div className="ws-grid">

          {/* ── Tile 1 — Data Connection (clickable) ─────────────── */}
          <div
            className="ws-tile-clickable"
            onClick={() => navigate('/connect')}
            style={{
              padding: 'var(--space-5, 20px)',
              borderRadius: '10px',
              background: 'var(--color-bg-card, #111827)',
              border: '1px solid var(--color-border, #1E3A5F)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2, 8px)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs, 11px)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-dim, #0284C7)',
              }}
            >
              Step 0
            </span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: 'var(--line-tight, 1.25)',
                color: 'var(--color-text, #E2E8F0)',
              }}
            >
              Data Connection
            </span>
            <span
              style={{
                fontSize: '13px',
                lineHeight: 'var(--line-normal, 1.4)',
                color: 'var(--color-text-dim, #94A3B8)',
              }}
            >
              Connect your data sources
            </span>
          </div>

          {/* ── Tile 2 — EMPHASIS (clickable, 2-col span) ────────── */}
          <div
            className="ws-tile-clickable ws-tile-2"
            onClick={() => navigate(tile2Dest)}
            style={{
              gridColumn: 'span 2',
              padding: 'var(--space-6, 24px)',
              borderRadius: '10px',
              background: 'var(--color-bg-surface, #1E293B)',
              border: '2px solid var(--color-accent, #0EA5E9)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3, 12px)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs, 11px)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-accent, #0EA5E9)',
              }}
            >
              {tile2Step}
            </span>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 700,
                lineHeight: 'var(--line-tight, 1.25)',
                color: 'var(--color-text, #E2E8F0)',
              }}
            >
              {tile2Label}
            </span>
            <span
              style={{
                fontSize: '15px',
                lineHeight: 'var(--line-normal, 1.4)',
                color: 'var(--color-text-dim, #94A3B8)',
              }}
            >
              {tile2Text}
            </span>
          </div>

          {/* ── Tiles 3–8 — Informational (display-only) ─────────── */}
          {infoTiles.map(({ step, title, text }) => (
            <div
              key={title}
              className="ws-tile-info"
              style={{
                opacity: 0.55,
                padding: 'var(--space-5, 20px)',
                borderRadius: '10px',
                background: 'var(--color-bg-card, #111827)',
                border: '1px solid var(--color-border, #1E3A5F)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2, 8px)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs, 11px)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-accent-dim, #0284C7)',
                }}
              >
                {step}
              </span>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  lineHeight: 'var(--line-tight, 1.25)',
                  color: 'var(--color-text, #E2E8F0)',
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  lineHeight: 'var(--line-normal, 1.4)',
                  color: 'var(--color-text-dim, #94A3B8)',
                }}
              >
                {text}
              </span>
            </div>
          ))}

        </div>
      </div>
    </>
  );
}
