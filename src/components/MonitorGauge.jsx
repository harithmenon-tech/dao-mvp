export default function MonitorGauge({ result }) {
  const statusColour = {
    Healthy: '#10B981',
    Watch: '#F59E0B',
    'At Risk': '#EF4444',
  };

  const urgencyColour = {
    Low: '#94A3B8',
    Medium: '#F59E0B',
    High: '#EF4444',
  };

  const sColour = statusColour[result.status] || '#94A3B8';
  const uColour = urgencyColour[result.urgency] || '#94A3B8';

  return (
    <div
      style={{
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '10px',
        padding: '18px 20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Status row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: sColour,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: sColour,
          }}
        >
          {result.status}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: uColour,
            border: `1px solid ${uColour}`,
            borderRadius: '4px',
            padding: '2px 7px',
          }}
        >
          {result.urgency}
        </span>
      </div>

      {/* Reasoning */}
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '1.55',
          color: '#CBD5E1',
        }}
      >
        {result.reasoning}
      </p>
    </div>
  );
}
