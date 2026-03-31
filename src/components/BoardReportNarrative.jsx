/**
 * BoardReportNarrative.jsx — T-S7.2
 * Step 7 Board Report screen: dark header, five narrative sections,
 * inline 3-bar SVG chart, and PDF download trigger.
 *
 * ALLOWED PROPS (from StepRouter scope):
 *   journal          — array of journal entries (may be undefined/empty)
 *   selectedOption   — decision option object (may be undefined)
 *   situationSummary — string or object with .summary / .title (may be undefined)
 *   activeDomain     — domain ID string (may be undefined)
 *
 * FORBIDDEN: no new npm deps, no useEffect, no API calls on mount.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDomain } from '../domainConfig';

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveStatusWording(riskLevel) {
  switch ((riskLevel || '').toUpperCase()) {
    case 'HIGH':   return 'Monitoring activated';
    case 'MEDIUM': return 'Flagged for Finance';
    default:       return 'Logged for Operations';
  }
}

/** Pick most recent Reviewed entry, fall back to most recent Confirmed. */
function resolveEntry(journal) {
  const arr = Array.isArray(journal) ? journal : [];
  const rev = [...arr].reverse();
  return rev.find(e => e?.status === 'Reviewed')
      || rev.find(e => e?.status === 'Confirmed')
      || null;
}

/** Last element of entry.reviews array, or null. */
function resolveReviewRecord(entry) {
  const reviews = Array.isArray(entry?.reviews) ? entry.reviews : [];
  return reviews.length > 0 ? reviews[reviews.length - 1] : null;
}

/** Normalise a numeric value; returns 0 for anything non-positive-numeric. */
function toNum(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ─── inline SVG 3-bar chart ─────────────────────────────────────────────────

function FinancialChart({ projected, actual, variance }) {
  const CHART_W   = 320;
  const CHART_H   = 160;
  const MAX_BAR_H = 100;
  const BAR_W     = 48;
  const STUB      = 8;   // minimum bar height when value is 0

  const vals   = [toNum(projected), toNum(actual), toNum(variance)];
  const maxVal = Math.max(...vals);

  function barH(v) {
    if (maxVal === 0) return STUB;
    return Math.max(STUB, Math.round((v / maxVal) * MAX_BAR_H));
  }

  const COLOURS = ['#0EA5E9', '#10B981', '#F59E0B'];
  const LABELS  = ['Projected', 'Actual', 'Variance'];

  // x centres for 3 bars evenly spread
  const centres = [74, 160, 246];

  const rawLabels = [projected, actual, variance];

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      width="100%"
      style={{ maxWidth: 320, display: 'block' }}
      aria-label="Financial impact chart: Projected, Actual, Variance"
    >
      {vals.map((v, i) => {
        const h  = barH(v);
        const x  = centres[i] - BAR_W / 2;
        const y  = MAX_BAR_H - h + 20;   // top-aligned within drawing area
        const rawVal = rawLabels[i];
        const displayVal = rawVal !== undefined && rawVal !== null && rawVal !== ''
          ? String(rawVal)
          : '—';

        return (
          <g key={LABELS[i]}>
            {/* bar */}
            <rect
              x={x} y={y}
              width={BAR_W} height={h}
              rx={4}
              fill={COLOURS[i]}
              opacity={0.85}
            />
            {/* value above bar */}
            <text
              x={centres[i]} y={y - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#E2E8F0"
            >
              {displayVal}
            </text>
            {/* label below chart area */}
            <text
              x={centres[i]} y={CHART_H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#94A3B8"
            >
              {LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── narrative card ──────────────────────────────────────────────────────────

function NarrativeCard({ label, content }) {
  return (
    <div style={{
      background:   '#111827',
      border:       '1px solid #1E3A5F',
      borderRadius: 10,
      padding:      '1rem',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: 1.5,
        color:         '#94A3B8',
        textTransform: 'uppercase',
        marginBottom:  6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   13,
        color:      '#E2E8F0',
        lineHeight: 1.65,
      }}>
        {content}
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function BoardReportNarrative({
  journal,
  selectedOption,
  situationSummary,
  activeDomain,
}) {
  const navigate       = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error,        setError]        = useState(null);

  // ── resolve journal entry & review record ──────────────────────────────
  const entry        = resolveEntry(journal);
  const reviewRecord = resolveReviewRecord(entry);

  // ── domain config ──────────────────────────────────────────────────────
  const domainObj = getDomain(activeDomain);
  const currency  = domainObj?.currency || '';

  // ── header values ──────────────────────────────────────────────────────
  const reportTitle = situationSummary?.title
                   || journal?.title          // graceful no-op if journal is array
                   || entry?.statement
                   || 'Decision Report';

  const decisionDate = journal?.decisionDate  // graceful no-op if journal is array
                    || entry?.date
                    || new Date().toLocaleDateString();

  // ── narrative card contents ────────────────────────────────────────────
  const situation = situationSummary?.summary
                 || journal?.situation        // graceful no-op
                 || entry?.context
                 || entry?.evidence
                 || 'Situation not recorded.';

  const decision = selectedOption?.label
    ? `${selectedOption.label}${selectedOption.rationale
        ? ' — ' + selectedOption.rationale
        : ''}`
    : 'Decision not recorded.';

  const outcome = journal?.outcome            // graceful no-op
               || reviewRecord?.outcome
               || 'Outcome not yet recorded.';

  const financialImpact = journal?.financialFigure   // graceful no-op
                       || journal?.financial_figure  // graceful no-op
                       || 'Financial impact not recorded.';

  const lesson = journal?.lesson              // graceful no-op
              || reviewRecord?.lesson
              || 'Lesson not yet recorded.';

  // ── SVG chart values ───────────────────────────────────────────────────
  const projectedImpact = journal?.projectedImpact;   // graceful no-op
  const actualOutcome   = journal?.actualOutcome;     // graceful no-op
  const varianceVal     = journal?.variance           // graceful no-op
                       || reviewRecord?.variance;

  // ── PDF download ───────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Payload reuses EXACT keys confirmed in seam inspection of
      // StepBoardReportTrigger.handleDownload (lines 3854–3874, App.jsx).
      const payload = {
        situationTitle:    entry?.statement || (typeof situationSummary === 'string' ? situationSummary : '') || '',
        situationSummary:  entry?.context   || entry?.evidence || (typeof situationSummary === 'string' ? situationSummary : '') || '',
        decisionLabel:     selectedOption?.label    || entry?.statement || '',
        decisionRationale: selectedOption?.rationale || entry?.rationale || '',
        decisionOwner:     entry?.owner     || '',
        decisionDate:      entry?.date      || '',
        reviewDate:        entry?.review_date || '',
        statusWording:     resolveStatusWording(selectedOption?.risk_level),
        outcome:           reviewRecord?.outcome  || '',
        lesson:            reviewRecord?.lesson   || '',
        variance:          reviewRecord?.variance || '',
        financialFigure:   '',  // per CTO ruling — no derivation
        currency,
        domain:            domainObj?.label || activeDomain || '',
        orgName:           '',  // profile not in scope; harmless empty
        generatedBy:       '',  // profile not in scope; harmless empty
        generatedDate:     new Date().toLocaleDateString('en-GB', {
                             day: 'numeric', month: 'long', year: 'numeric',
                           }),
      };

      const response = await fetch('/api/board-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Server returned ' + response.status);

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'DAO-Board-Report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed. Please try again.');
      console.error('[BoardReportNarrative] PDF download error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>

      {/* ── DARK EXECUTIVE HEADER ── */}
      <div style={{
        width:          '100%',
        background:     '#0B1120',
        borderRadius:   12,
        padding:        '24px 28px',
        marginBottom:   24,
        boxSizing:      'border-box',
      }}>
        <div style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: 2,
          color:         '#0EA5E9',
          textTransform: 'uppercase',
          fontVariant:   'small-caps',
          marginBottom:  8,
        }}>
          Board Decision Report
        </div>
        <div style={{
          fontSize:   22,
          fontWeight: 700,
          color:      '#F1F5F9',
          marginBottom: 6,
          lineHeight: 1.3,
        }}>
          {reportTitle}
        </div>
        <div style={{
          fontSize: 12,
          color:    '#64748B',
        }}>
          Decision date: {decisionDate}
        </div>
      </div>

      {/* ── FIVE NARRATIVE CARDS ── */}
      <NarrativeCard label="Situation"        content={situation}       />
      <NarrativeCard label="Decision"         content={decision}        />
      <NarrativeCard label="Outcome"          content={outcome}         />
      <NarrativeCard label="Financial Impact" content={financialImpact} />
      <NarrativeCard label="Lesson"           content={lesson}          />

      {/* ── 3-BAR SVG CHART ── */}
      <div style={{
        background:   '#111827',
        border:       '1px solid #1E3A5F',
        borderRadius: 10,
        padding:      '1rem',
        marginBottom: 24,
      }}>
        <div style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: 1.5,
          color:         '#94A3B8',
          textTransform: 'uppercase',
          marginBottom:  12,
        }}>
          Financial Impact Overview
        </div>
        <FinancialChart
          projected={projectedImpact}
          actual={actualOutcome}
          variance={varianceVal}
        />
      </div>

      {/* ── DOWNLOAD BUTTON ── */}
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        style={{
          background:  isGenerating ? '#1E3A5F' : '#0EA5E9',
          color:       isGenerating ? '#94A3B8' : '#0B1120',
          border:      'none',
          borderRadius: 8,
          padding:     '12px 28px',
          fontSize:    14,
          fontWeight:  700,
          cursor:      isGenerating ? 'not-allowed' : 'pointer',
          opacity:     isGenerating ? 0.6 : 1,
          fontFamily:  "'DM Sans', sans-serif",
          transition:  'all 0.15s',
        }}
      >
        {isGenerating ? 'Generating\u2026' : 'Download Board Report'}
      </button>

      {/* ── COMPLETION STATE ── */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#E2E8F0',
          marginBottom: 16,
          letterSpacing: '0.01em'
        }}>
          Decision is Now Live
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: '#0EA5E9',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Return to DAO Overview →
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#EF4444' }}>
          {error}
        </div>
      )}
    </div>
  );
}
