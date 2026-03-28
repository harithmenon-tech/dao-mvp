import { useEffect } from 'react';
// ─── Toast — T-CU.2 ───────────────────────────────────────────────────────
// Minimal non-blocking shell feedback. No external library. No context.
// Mount once in ShellFrame. Trigger via lifted state in App.jsx.
// Auto-dismisses after DISMISS_MS. Caller resets visible via onDismiss.
// ─────────────────────────────────────────────────────────────────────────
const DISMISS_MS = 3000;
const ACCENT = '#0EA5E9';
const GREEN  = '#10B981';
export default function Toast({ message, type = 'success', visible, onDismiss }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);
  if (!visible) return null;
  const color = type === 'success' ? GREEN : ACCENT;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:     'fixed',
        bottom:       96,
        left:         '50%',
        transform:    'translateX(-50%)',
        zIndex:       1100,
        background:   '#1E293B',
        border:       `1px solid ${color}40`,
        borderLeft:   `3px solid ${color}`,
        borderRadius: 8,
        padding:      '10px 20px',
        fontSize:     13,
        fontWeight:   500,
        color:        '#E2E8F0',
        fontFamily:   "'DM Sans', sans-serif",
        boxShadow:    '0 4px 24px rgba(0,0,0,0.4)',
        whiteSpace:   'nowrap',
        pointerEvents:'none',
        animation:    'toast-in 0.2s ease',
      }}
    >
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
        }
      `}</style>
      <span style={{ color, marginRight: 8 }}>✓</span>
      {message}
    </div>
  );
}
