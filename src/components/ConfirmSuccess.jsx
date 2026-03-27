import { useState, useEffect } from "react";

// ─── Animation constants ───────────────────────────────────────────────────
// Total visible animation: 2500ms
// Circle draw: 0ms → 1200ms
// Tick draw: 900ms → 2200ms (overlaps with circle tail)

const KEYFRAME_CSS = `
@keyframes cs-circle-draw {
  0%   { stroke-dashoffset: 283; }
  100% { stroke-dashoffset: 0; }
}
@keyframes cs-tick-draw {
  0%   { stroke-dashoffset: 80; }
  100% { stroke-dashoffset: 0; }
}
@keyframes cs-fade-in {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
`;

// ─── ConfirmSuccess ────────────────────────────────────────────────────────
export default function ConfirmSuccess() {
  const [resting, setResting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setResting(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Inject keyframes once into <head> via a <style> tag rendered inline */}
      <style>{KEYFRAME_CSS}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          minHeight: 320,
          padding: "48px 24px",
          color: "#E2E8F0",
          background: "#0B1120",
          boxSizing: "border-box",
        }}
      >
        {/* Heading — always visible */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#E2E8F0",
            margin: "0 0 32px",
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          DECISION LOGGED
        </h1>

        {resting ? (
          /* ── Resting state ── */
          <p
            style={{
              fontSize: 15,
              color: "#94A3B8",
              margin: 0,
              textAlign: "center",
            }}
          >
            Monitoring step loading…
          </p>
        ) : (
          /* ── Animated state ── */
          <>
            {/* SVG animated checkmark */}
            <svg
              viewBox="0 0 100 100"
              width={96}
              height={96}
              aria-hidden="true"
              style={{ display: "block", marginBottom: 28, overflow: "visible" }}
            >
              {/* Circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#10B981"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset="283"
                style={{
                  animation: "cs-circle-draw 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                  transformOrigin: "50% 50%",
                  transform: "rotate(-90deg)",
                }}
              />
              {/* Tick — starts after circle is partially drawn */}
              <polyline
                points="28,52 44,68 72,34"
                fill="none"
                stroke="#10B981"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="80"
                strokeDashoffset="80"
                style={{
                  animation:
                    "cs-tick-draw 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.9s forwards",
                }}
              />
            </svg>

            <p
              style={{
                fontSize: 15,
                color: "#94A3B8",
                margin: 0,
                textAlign: "center",
                animation: "cs-fade-in 0.4s ease 0.4s both",
              }}
            >
              Your decision has been recorded.
            </p>
          </>
        )}
      </div>
    </>
  );
}
