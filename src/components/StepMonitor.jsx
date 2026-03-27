import { useEffect, useState } from 'react';
import MonitorGauge from './MonitorGauge.jsx';

export default function StepMonitor({
  selectedOption,
  situationSummary,
  journal,
  findings,
  activeDomain,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
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
      : 'Decision under active monitoring';

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
        OPERATIONAL WATCH
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
    </div>
  );
}
