// Right-side drawer with entity detail, summary, stats, triggers, and examples

const verdictLabel = (v) => ({ helpful: 'helpful', partial: 'partial', failed: 'failed', bad: 'bad' }[v] || v);

const Rating = ({ n }) => (
  <span className="rating-dots">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={`rating-dot ${i <= n ? 'on' : ''}`} />
    ))}
  </span>
);

const Example = ({ ex }) => (
  <div className="example">
    <div className="example-head">
      <div className="example-head-left">
        <strong>{ex.session}</strong> · {ex.when}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Rating n={ex.rating} />
        {ex.verdict && <span className={`example-verdict ${ex.verdict}`}>{verdictLabel(ex.verdict)}</span>}
      </div>
    </div>
    <div className="example-body">
      <div className="example-row">
        <div className="example-row-label">Input</div>
        <div className="example-row-content">{ex.input}</div>
      </div>
      {ex.trace && ex.trace.length > 0 && (
        <div className="example-row">
          <div className="example-row-label">Trace</div>
          <div className="example-row-content">
            {ex.trace.map((t, i) => (
              <div key={i} className="example-trace-step">
                <span>
                  {t.type === 'tool' && (
                    <>
                      <span className="example-trace-name">→ {t.name}</span>
                      {t.args && <span style={{ color: 'var(--ink-3)' }}>  {t.args}</span>}
                    </>
                  )}
                  {t.type === 'error' && <span className="example-trace-name error">✕ {t.text}</span>}
                  {t.type === 'note' && <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>{t.text}</span>}
                </span>
                {t.ms != null && <span className="example-trace-ms">{t.ms}ms</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="example-row">
        <div className="example-row-label">Output</div>
        <div className="example-row-content">{ex.output}</div>
      </div>
    </div>
  </div>
);

const Drawer = ({ entity, onClose }) => {
  const on = !!entity;
  return (
    <>
      <div className={`drawer-backdrop ${on ? 'on' : ''}`} onClick={onClose} />
      <aside className={`drawer ${on ? 'on' : ''}`} aria-hidden={!on}>
        {entity && (
          <>
            <div className="drawer-head">
              <button className="drawer-close" onClick={onClose} aria-label="close">
                ×
              </button>
              <div className="drawer-kind">
                <span className={`status-dot ${entity.status}`} />
                {entity.kind.toUpperCase()} · {entity.status}
              </div>
              <h2 className="drawer-title">{entity.name}</h2>
              <div className="drawer-source">{entity.source}</div>
              <div>
                {(entity.tags || []).map((t) => (
                  <span key={t} className={`tag ${t === 'unused' || t === 'missing' ? 'warn' : t === 'auth-error' ? 'bad' : ''}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="drawer-body">
              {/* Helpfulness score hero */}
              <div className="drawer-score">
                <ScorePill score={entity.score} size="lg" />
                <div className="drawer-score-meta">
                  <div className="drawer-score-label">Helpfulness</div>
                  <div className="drawer-score-rating">
                    <RatingReadout avg={entity.avgRating} n={entity.ratingN} />
                  </div>
                  <div className="drawer-score-hint">
                    {entity.score == null
                      ? 'Needs CLI session ratings before a score can be computed.'
                      : entity.score >= 70
                      ? 'Earning its place — keep.'
                      : entity.score >= 40
                      ? 'Middling. Review recent examples to see what\'s off.'
                      : 'Low signal. Consider pruning or replacing.'}
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-section-label">Summary</div>
                <div className="drawer-summary">{entity.summary}</div>
              </div>

              <div className="drawer-section">
                <div className="drawer-section-label">Usage · last 30 days</div>
                <div className="drawer-stats">
                  <div className="drawer-stat">
                    <div className="drawer-stat-label">Sessions</div>
                    <div className="drawer-stat-value">{entity.sessions}</div>
                  </div>
                  <div className="drawer-stat">
                    <div className="drawer-stat-label">Invocations</div>
                    <div className="drawer-stat-value">{entity.invocations}</div>
                  </div>
                  <div className="drawer-stat">
                    <div className="drawer-stat-label">% sessions</div>
                    <div className="drawer-stat-value">{entity.pctOfSessions}<span style={{fontSize: 14, color: 'var(--ink-3)'}}>%</span></div>
                  </div>
                  <div className="drawer-stat">
                    <div className="drawer-stat-label">Avg latency</div>
                    <div className="drawer-stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{entity.avgLatency}</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <Spark values={entity.spark} w={504} h={52} stroke="var(--ink)" fill="var(--accent)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span>30d ago</span>
                  <span>last used {entity.lastUsed}</span>
                </div>
              </div>

              {entity.triggers && entity.triggers.length > 0 && (
                <div className="drawer-section">
                  <div className="drawer-section-label">Triggered by</div>
                  <div className="trigger-list">
                    {entity.triggers.map((t, i) => (
                      <div key={i} className="trigger-item">{t}</div>
                    ))}
                  </div>
                </div>
              )}

              {entity.tools && entity.tools.length > 0 && (
                <div className="drawer-section">
                  <div className="drawer-section-label">
                    Exposed tools <span>{entity.tools.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {entity.tools.map((t) => (
                      <span key={t} className="tag accent" style={{ fontSize: 10, padding: '3px 8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {entity.values && (
                <div className="drawer-section">
                  <div className="drawer-section-label">Values</div>
                  <div className="kv-list">
                    {Object.entries(entity.values).map(([k, v]) => (
                      <div key={k} className="kv-row">
                        <span className="kv-key">{k}</span>
                        <span className="kv-val">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <div className="drawer-section-label">
                  <span>Recent examples</span>
                  <span>{entity.examples ? entity.examples.length : 0}</span>
                </div>
                {entity.examples && entity.examples.length > 0 ? (
                  entity.examples.map((ex, i) => <Example key={i} ex={ex} />)
                ) : (
                  <div className="empty">No recorded examples yet.</div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

Object.assign(window, { Drawer });
