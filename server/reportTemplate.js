// reportTemplate.js — T-S7.1
// Server-side HTML template for Step 7 Board Report PDF generation.
// Two-layer sanitisation: markdown stripping is applied first, then HTML escaping.
// Currency is never hardcoded — received via POST body and passed through only.

// ─── Layer 1: Strip markdown markers ─────────────────────────────────────────
// Removes **, *, leading #, `, and link syntax from a string.
// Does NOT perform HTML escaping — that is a separate distinct step below.
function stripMarkdown(str) {
  if (!str) return '';
  return String(str)
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s?/gm, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// ─── Layer 2: HTML-escape special characters ──────────────────────────────────
// Prevents injection of raw HTML into the PDF template surface.
// Applied AFTER markdown stripping — never before.
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Combined: markdown strip THEN HTML escape ────────────────────────────────
// Order is mandatory: strip markdown first so markdown characters are gone
// before HTML escaping runs.
function sanitise(str) {
  return escapeHtml(stripMarkdown(str));
}

// ─── Outcome colour mapping ───────────────────────────────────────────────────
function outcomeColor(outcome) {
  switch (outcome) {
    case 'Exceeded': return '#10B981';
    case 'Met':      return '#0EA5E9';
    case 'Partial':  return '#F59E0B';
    case 'Missed':   return '#EF4444';
    default:         return '#94A3B8';
  }
}

// ─── Main template function ───────────────────────────────────────────────────
// All fields are sanitised (markdown strip + HTML escape) before insertion.
// No currency symbol is hardcoded anywhere in this file.
export function buildReportTemplate(fields) {
  const {
    situationTitle,
    situationSummary,
    decisionLabel,
    decisionRationale,
    decisionOwner,
    decisionDate,
    reviewDate,
    statusWording,
    outcome,
    lesson,
    variance,
    financialFigure,
    currency,
    domain,
    orgName,
    generatedBy,
    generatedDate,
  } = fields;

  const s = {
    situationTitle:    sanitise(situationTitle),
    situationSummary:  sanitise(situationSummary),
    decisionLabel:     sanitise(decisionLabel),
    decisionRationale: sanitise(decisionRationale),
    decisionOwner:     sanitise(decisionOwner),
    decisionDate:      sanitise(decisionDate),
    reviewDate:        sanitise(reviewDate),
    statusWording:     sanitise(statusWording),
    outcome:           sanitise(outcome),
    lesson:            sanitise(lesson),
    variance:          sanitise(variance),
    financialFigure:   sanitise(financialFigure),
    currency:          sanitise(currency),
    domain:            sanitise(domain),
    orgName:           sanitise(orgName),
    generatedBy:       sanitise(generatedBy),
    generatedDate:     sanitise(generatedDate),
  };

  const oColor = outcomeColor(outcome);
  const financialDisplay = s.financialFigure || 'Not quantified';
  const varianceDisplay  = s.variance || null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>DAO Board Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0B1120;
      color: #E2E8F0;
      font-size: 13px;
      line-height: 1.6;
    }
    .page {
      width: 210mm;
      min-height: 267mm;
      padding: 15mm;
      background: #0B1120;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .report-header {
      background: #111827;
      border-bottom: 2px solid #0EA5E9;
      padding: 18px 20px;
      margin: -15mm -15mm 20px -15mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #0EA5E9; }
    .header-org   { font-size: 12px; font-weight: 600; color: #E2E8F0; margin-top: 4px; }
    .header-meta  { font-size: 10px; color: #94A3B8; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #94A3B8; }
    .section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 2px;
      color: #94A3B8; text-transform: uppercase; margin-bottom: 8px;
    }
    .card {
      background: #111827; border: 1px solid #1E3A5F;
      border-radius: 8px; padding: 18px 20px; margin-bottom: 16px;
    }
    .card-title { font-size: 18px; font-weight: 700; color: #E2E8F0; margin-bottom: 10px; }
    .card-body  { font-size: 13px; color: #CBD5E1; line-height: 1.7; }
    .meta-row   { display: flex; gap: 28px; margin-top: 14px; flex-wrap: wrap; }
    .meta-item  { display: flex; flex-direction: column; gap: 2px; }
    .meta-key   { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #94A3B8; text-transform: uppercase; }
    .meta-val   { font-size: 12px; font-weight: 600; color: #E2E8F0; }
    .status-chip {
      display: inline-block; font-size: 11px; font-weight: 600;
      background: #0EA5E920; color: #0EA5E9;
      border: 1px solid #0EA5E940; border-radius: 4px; padding: 2px 10px;
    }
    .outcome-badge {
      display: inline-block; font-size: 13px; font-weight: 700;
      border-radius: 6px; padding: 6px 16px; margin-bottom: 14px;
      color: #0B1120; background: ${oColor};
    }
    .financial-figure { font-size: 36px; font-weight: 700; color: #0EA5E9; margin-bottom: 6px; }
    .financial-label  { font-size: 11px; color: #94A3B8; }
    .divider { border: none; border-top: 1px solid #1E3A5F; margin: 20px 0; }
    .footer {
      position: fixed; bottom: 10mm; left: 15mm; right: 15mm;
      font-size: 9px; color: #475569;
      display: flex; justify-content: space-between;
      border-top: 1px solid #1E3A5F; padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- PAGE 1: SITUATION -->
  <div class="page">
    <div class="report-header">
      <div>
        <div class="header-brand">DECISION ACCOUNTABILITY OS</div>
        <div class="header-org">${s.orgName} &nbsp;·&nbsp; ${s.domain}</div>
        <div class="header-meta">Board Report &nbsp;·&nbsp; Generated ${s.generatedDate} &nbsp;·&nbsp; ${s.generatedBy}</div>
      </div>
      <div class="header-right">
        <div class="header-label">CONFIDENTIAL</div>
        <div class="header-label" style="margin-top:2px;">30GENS</div>
      </div>
    </div>
    <div class="section-label">Situation</div>
    <div class="card">
      <div class="card-title">${s.situationTitle}</div>
      <div class="card-body">${s.situationSummary}</div>
    </div>
  </div>

  <!-- PAGE 2: DECISION -->
  <div class="page">
    <div class="report-header">
      <div>
        <div class="header-brand">DECISION ACCOUNTABILITY OS</div>
        <div class="header-org">${s.orgName} &nbsp;·&nbsp; ${s.domain}</div>
        <div class="header-meta">Board Report &nbsp;·&nbsp; Generated ${s.generatedDate} &nbsp;·&nbsp; ${s.generatedBy}</div>
      </div>
      <div class="header-right">
        <div class="header-label">CONFIDENTIAL</div>
        <div class="header-label" style="margin-top:2px;">30GENS</div>
      </div>
    </div>
    <div class="section-label">Decision</div>
    <div class="card">
      <div class="card-title">${s.decisionLabel}</div>
      <div class="card-body">${s.decisionRationale}</div>
      <div class="meta-row">
        <div class="meta-item">
          <span class="meta-key">Owner</span>
          <span class="meta-val">${s.decisionOwner || '—'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-key">Decision Date</span>
          <span class="meta-val">${s.decisionDate}</span>
        </div>
        <div class="meta-item">
          <span class="meta-key">Review Date</span>
          <span class="meta-val">${s.reviewDate}</span>
        </div>
        <div class="meta-item">
          <span class="meta-key">Status</span>
          <span class="status-chip">${s.statusWording}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 3: OUTCOME + LESSON -->
  <div class="page">
    <div class="report-header">
      <div>
        <div class="header-brand">DECISION ACCOUNTABILITY OS</div>
        <div class="header-org">${s.orgName} &nbsp;·&nbsp; ${s.domain}</div>
        <div class="header-meta">Board Report &nbsp;·&nbsp; Generated ${s.generatedDate} &nbsp;·&nbsp; ${s.generatedBy}</div>
      </div>
      <div class="header-right">
        <div class="header-label">CONFIDENTIAL</div>
        <div class="header-label" style="margin-top:2px;">30GENS</div>
      </div>
    </div>
    <div class="section-label">Outcome</div>
    <div class="card">
      <div class="outcome-badge">${s.outcome}</div>
      ${varianceDisplay ? `<div class="meta-item" style="margin-bottom:12px;"><span class="meta-key">Variance vs Expected</span><span class="meta-val" style="display:block;margin-top:2px;">${varianceDisplay}</span></div>` : ''}
      <hr class="divider"/>
      <div class="section-label">Lesson</div>
      <div class="card-body">${s.lesson}</div>
    </div>
  </div>

  <!-- PAGE 4: FINANCIAL IMPACT -->
  <div class="page">
    <div class="report-header">
      <div>
        <div class="header-brand">DECISION ACCOUNTABILITY OS</div>
        <div class="header-org">${s.orgName} &nbsp;·&nbsp; ${s.domain}</div>
        <div class="header-meta">Board Report &nbsp;·&nbsp; Generated ${s.generatedDate} &nbsp;·&nbsp; ${s.generatedBy}</div>
      </div>
      <div class="header-right">
        <div class="header-label">CONFIDENTIAL</div>
        <div class="header-label" style="margin-top:2px;">30GENS</div>
      </div>
    </div>
    <div class="section-label">Financial Impact</div>
    <div class="card">
      <div class="financial-figure">${financialDisplay}</div>
      <div class="financial-label">${s.currency ? 'Currency: ' + s.currency : 'Currency not specified'}</div>
      <hr class="divider"/>
      <div class="card-body" style="margin-top:8px;">
        This figure reflects the operational and financial context at the time of the decision.
        ${varianceDisplay ? 'Reported variance: ' + varianceDisplay + '.' : ''}
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Decision Accountability OS &nbsp;·&nbsp; 30GENS &nbsp;·&nbsp; CONFIDENTIAL</span>
    <span>Generated ${s.generatedDate}</span>
  </div>

</body>
</html>`;
}
