// Sparkline + chart primitives

const Spark = ({ values, w = 80, h = 22, stroke = 'currentColor', fill = 'none' }) => {
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1 || 1);
  const points = values.map((v, i) => [i * step, h - (v / max) * (h - 2) - 1]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill !== 'none' && <path d={area} fill={fill} opacity={0.12} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth="1" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="1.6" fill={stroke} />
    </svg>
  );
};

const HeroChart = ({ values }) => {
  const max = Math.max(...values, 1);
  return (
    <div className="hero-chart">
      <div className="hero-chart-header">
        <div className="hero-label">Activity · 30 days</div>
        <div className="hero-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          peak {max} · today{' '}
          <span style={{ color: 'var(--accent)' }}>{values[values.length - 1]}</span>
        </div>
      </div>
      <div className="hero-chart-body">
        {values.map((v, i) => (
          <div
            key={i}
            className={`bar ${i === values.length - 1 ? 'today' : ''}`}
            style={{ height: `${(v / max) * 100}%` }}
            title={`Day ${i + 1}: ${v} invocations`}
          />
        ))}
      </div>
      <div className="hero-chart-axis">
        <span>30d ago</span>
        <span>21d</span>
        <span>14d</span>
        <span>7d</span>
        <span>today</span>
      </div>
    </div>
  );
};

Object.assign(window, { Spark, HeroChart });
