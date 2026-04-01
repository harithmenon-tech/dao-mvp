import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MonitorGauge from './MonitorGauge.jsx';
import InterventionTimeline from './InterventionTimeline.jsx';

// Module-level in-flight guard — survives remount, cleared on request completion/failure.
// Key: situation id (from route params). Prevents duplicate /api/decision-health calls
// caused by remount churn while a request is already active for this situation.
const _healthInFlight = new Set();

export default function StepMonitor({
  selectedOption,
  situationSummary,
  journal,
  findings,
  activeDomain,
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const flightKey = `health-${id}`;
    if (_healthInFlight.has(flightKey)) return;
    _healthInFlight.add(flightKey);

    let cancelled = false;

    const dataSummary = findings ? JSON.stringify(findings).slice(0, 800) : '';

    fetch('/api/decision-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisions: journal,
        dataSummary,
        activeDomain,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Non-OK response');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      })
      .finally(() => {
        _healthInFlight.delete(flightKey);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const centred = {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#94A3B8',
    minHeight: '120px',
  };

  const subheading =
    situationSummary && situationSummary.trim()
      ? situationSummary
      : 'DAO is monitoring outcomes — review when ready';

  const confirmedEntry = Array.isArray(journal)
    ? [...journal].reverse().find(e => e.status === 'Confirmed')
    : null;
  const decisionDate = confirmedEntry ? confirmedEntry.date : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 320,
        padding: '32px 24px',
        background: '#0B1120',
        color: '#E2E8F0',
        boxSizing: 'border-box',
      }}
    >
      {/* Heading */}
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: '#94A3B8',
          textTransform: 'uppercase',
        }}
      >
        DECISION UNDER ACTIVE WATCH
      </p>

      {/* Subheading */}
      <p
        style={{
          margin: '0 0 28px',
          fontSize: 15,
          fontWeight: 600,
          color: '#E2E8F0',
        }}
      >
        {subheading}
      </p>

      {/* States */}
      {loading && <div style={centred}>Assessing decision health…</div>}

      {!loading && error && (
        <div style={centred}>Health check unavailable.</div>
      )}

      {!loading && !error && results.length === 0 && (
        <div style={centred}>No active decisions to monitor.</div>
      )}

      {!loading && !error && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.map((result) => (
            <MonitorGauge key={result.id} result={result} />
          ))}
        </div>
      )}
      <InterventionTimeline decisionDate={decisionDate} />
      {/* T-S6.1 — Step 5 → Step 6 enabling CTA */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #1E3A5F' }}>
        <button
          onClick={() => navigate(`/situation/${id}/step/6`)}
          style={{
            background: '#0EA5E9',
            color: '#0B1120',
            border: 'none',
            borderRadius: 8,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Review DAO Discoveries →
        </button>
      </div>
    </div>
  );
}
