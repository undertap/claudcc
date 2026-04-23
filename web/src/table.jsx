// Entity table — list of skills/plugins/mcps/hooks/etc.

const fmtNum = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

const EntityRow = ({ e, selected, onClick, maxPct }) => {
  const fillClass = e.status === 'active' ? '' : e.status === 'error' || e.status === 'missing' ? 'muted' : 'muted';
  const trendNum = parseInt(e.sessionsTrend, 10) || 0;
  return (
    <tr className={selected ? 'selected' : ''} onClick={onClick}>
      <td style={{ width: '26%' }}>
        <div className="cell-name">
          <span className={`status-dot ${e.status}`} />
          <div className="cell-name-text">
            <div className="cell-name-label">{e.name}</div>
            <div className="cell-sub">{e.source}</div>
          </div>
        </div>
      </td>
      <td style={{ width: 140 }}>
        <ScoreChip score={e.score} />
        <div className="cell-meta">
          {e.avgRating != null ? `${e.avgRating.toFixed(1)} avg · ${e.ratingN}` : 'not yet rated'}
        </div>
      </td>
      <td className="bar-cell">
        <div className="bar-cell-track">
          <div
            className={`bar-cell-fill ${e.status === 'active' ? 'accent' : 'muted'}`}
            style={{ width: `${Math.min(100, (e.pctOfSessions / maxPct) * 100)}%` }}
          />
        </div>
        <div className="bar-cell-label">
          <span>{e.pctOfSessions}% of sessions</span>
          <span>{e.sessions} sess</span>
        </div>
      </td>
      <td className="cell-mono" style={{ width: 90 }}>
        {fmtNum(e.invocations)}
        <div className="cell-meta">invocations</div>
      </td>
      <td style={{ width: 100 }}>
        <Spark values={e.spark} stroke={e.status === 'active' ? 'var(--ink)' : 'var(--ink-4)'} />
        <div className="cell-meta">
          {trendNum > 0 ? (
            <span style={{ color: 'var(--good)' }}>▲ {trendNum}</span>
          ) : trendNum < 0 ? (
            <span style={{ color: 'var(--bad)' }}>▼ {Math.abs(trendNum)}</span>
          ) : (
            <span>—</span>
          )}
        </div>
      </td>
      <td className="cell-meta" style={{ width: 100, textAlign: 'right' }}>
        {e.lastUsed}
      </td>
    </tr>
  );
};

const EntityTable = ({ items, selectedId, onSelect }) => {
  const maxPct = Math.max(...items.map((i) => i.pctOfSessions), 1);
  if (items.length === 0) {
    return <div className="empty">Nothing matches that filter.</div>;
  }
  return (
    <table className="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Score</th>
          <th>Usage</th>
          <th style={{ textAlign: 'right' }}>Count</th>
          <th>Trend</th>
          <th style={{ textAlign: 'right' }}>Last used</th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => (
          <EntityRow key={e.id} e={e} selected={e.id === selectedId} onClick={() => onSelect(e)} maxPct={maxPct} />
        ))}
      </tbody>
    </table>
  );
};

Object.assign(window, { EntityTable });
