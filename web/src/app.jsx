// Main app — sidebar, topbar, hero, entity sections, drawer, tweaks

const SECTIONS = [
  { id: 'overview', label: 'Overview', kind: null },
  { id: 'skills', label: 'Skills', kind: 'skill', data: 'skills' },
  { id: 'plugins', label: 'Plugins', kind: 'plugin', data: 'plugins' },
  { id: 'mcps', label: 'MCP Servers', kind: 'mcp', data: 'mcps' },
  { id: 'hooks', label: 'Hooks', kind: 'hook', data: 'hooks' },
  { id: 'claudemds', label: 'CLAUDE.md', kind: 'claudemd', data: 'claudemds' },
  { id: 'settings', label: 'Settings', kind: 'settings', data: 'settings' },
];

const SECTION_DESC = {
  skills: 'Prompt-skill library. Loaded into context when their triggers fire. Invoked by the model itself, not the user.',
  plugins: 'Extensions that add tools to Claude Code. Installed via the plugin registry.',
  mcps: 'Model Context Protocol servers. External processes that expose tools over stdio or HTTP.',
  hooks: 'Shell scripts that run on lifecycle events — before tools, after sessions, on errors.',
  claudemds: 'Markdown files auto-injected into every session to steer Claude\'s behavior.',
  settings: 'JSON configuration — model defaults, permissions, and editor preferences.',
};

const fmtNumBig = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "theme": "light",
  "accent": "#e8573f",
  "timeWindow": "30d"
}/*EDITMODE-END*/;

const App = () => {
  const D = window.__DATA__;
  const [currentSection, setCurrentSection] = React.useState('overview');
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  // Tweaks state
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [density, setDensity] = React.useState(TWEAK_DEFAULTS.density);
  const [theme, setTheme] = React.useState(TWEAK_DEFAULTS.theme);
  const [accent, setAccent] = React.useState(TWEAK_DEFAULTS.accent);
  const [timeWindow, setTimeWindow] = React.useState(TWEAK_DEFAULTS.timeWindow);

  // persist selection + section in localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('ccm-section');
    if (saved) setCurrentSection(saved);
  }, []);
  React.useEffect(() => {
    localStorage.setItem('ccm-section', currentSection);
  }, [currentSection]);

  // Apply density/theme/accent to root
  React.useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--accent', accent);
    const dark = accent;
    // derive a darker ink version of accent for hover
    document.documentElement.style.setProperty('--accent-ink', accent);
  }, [density, theme, accent]);

  // Tweaks — edit mode protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const persistTweaks = (edits) => {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  };

  // ESC closes drawer
  React.useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Today formatted
  const todayStr = D.today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Sidebar counts
  const counts = {
    overview: null,
    skills: D.skills.length,
    plugins: D.plugins.length,
    mcps: D.mcps.length,
    hooks: D.hooks.length,
    claudemds: D.claudemds.length,
    settings: D.settings.length,
  };

  // Filter
  const filterItems = (items) => {
    let r = items;
    if (statusFilter !== 'all') r = r.filter((x) => x.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (x) =>
          x.name.toLowerCase().includes(q) ||
          x.summary.toLowerCase().includes(q) ||
          (x.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return r;
  };

  const isOverview = currentSection === 'overview';
  const activeSection = SECTIONS.find((s) => s.id === currentSection);

  return (
    <>
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <span className="sidebar-brand-dot"></span>
            <span className="sidebar-brand-name">Mentor</span>
          </div>
          <div className="sidebar-brand-sub">Claude Code · local</div>
        </div>

        <div className="sidebar-section">Inspect</div>
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            className={`sidebar-item ${s.id === currentSection ? 'active' : ''}`}
            onClick={() => {
              setCurrentSection(s.id);
              setSelected(null);
            }}
          >
            <span>{s.label}</span>
            {counts[s.id] != null && <span className="sidebar-item-count">{counts[s.id]}</span>}
          </div>
        ))}

        <div className="sidebar-section">Health</div>
        <div className="sidebar-item">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="status-dot active" /> Active
          </span>
          <span className="sidebar-item-count">{D.activeCount}</span>
        </div>
        <div className="sidebar-item">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="status-dot dormant" /> Dormant
          </span>
          <span className="sidebar-item-count">{D.dormantCount}</span>
        </div>
        <div className="sidebar-item">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="status-dot error" /> Needs attention
          </span>
          <span className="sidebar-item-count">{D.errorCount}</span>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <span>host</span>
            <span>local</span>
          </div>
          <div className="sidebar-footer-row">
            <span>cli</span>
            <span>v1.8.3</span>
          </div>
          <div className="sidebar-footer-row">
            <span>synced</span>
            <span>just now</span>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="main">
        <div className="main-inner">
          <div className="topbar">
            <div>
              {!isOverview && (
                <div className="topbar-crumb">Setup · {activeSection.label}</div>
              )}
              <h1 className="topbar-title">
                {isOverview ? (
                  <>Anatomy of your <em>claude code</em></>
                ) : (
                  <>
                    {activeSection.label}.
                    {SECTION_DESC[activeSection.id] && (
                      <span className="topbar-info-wrap">
                        <button className="topbar-info" aria-label="about this section">i</button>
                        <span className="topbar-info-tip">{SECTION_DESC[activeSection.id]}</span>
                      </span>
                    )}
                  </>
                )}
              </h1>
            </div>
            <div className="topbar-meta">
              <div>{todayStr}</div>
              <div>
                window · <span className="topbar-meta-value">{timeWindow}</span>
              </div>
              <div>
                total sessions · <span className="topbar-meta-value">{D.totalSessions}</span>
              </div>
            </div>
          </div>

          {isOverview ? (
            <OverviewView D={D} onNav={(id, ent) => { setCurrentSection(id); setSelected(ent || null); }} onSelect={(e) => setSelected(e)} />
          ) : (
            <SectionView
              section={activeSection}
              items={D[activeSection.data]}
              filtered={filterItems(D[activeSection.data])}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          )}
        </div>
      </main>

      {/* Drawer */}
      <Drawer entity={selected} onClose={() => setSelected(null)} />

      {/* Tweaks */}
      <div className={`tweaks ${tweaksOpen ? 'on' : ''}`}>
        <h4>Tweaks</h4>
        <div className="tweak-row">
          <span className="tweak-label">Density</span>
          <div className="tweak-seg">
            {['comfortable', 'compact'].map((v) => (
              <button
                key={v}
                className={density === v ? 'on' : ''}
                onClick={() => { setDensity(v); persistTweaks({ density: v }); }}
              >
                {v === 'comfortable' ? 'Comfy' : 'Compact'}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="tweak-label">Theme</span>
          <div className="tweak-seg">
            {['light', 'dark'].map((v) => (
              <button key={v} className={theme === v ? 'on' : ''} onClick={() => { setTheme(v); persistTweaks({ theme: v }); }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="tweak-label">Accent</span>
          <div className="tweak-swatches">
            {['#e8573f', '#c5ff3d', '#7dd3b8', '#ffd24a', '#a989ff'].map((c) => (
              <span
                key={c}
                className={`tweak-swatch ${accent === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => { setAccent(c); persistTweaks({ accent: c }); }}
              />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="tweak-label">Window</span>
          <div className="tweak-seg">
            {['7d', '30d', '90d'].map((v) => (
              <button key={v} className={timeWindow === v ? 'on' : ''} onClick={() => { setTimeWindow(v); persistTweaks({ timeWindow: v }); }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(244,241,234,0.4)', marginTop: 12, lineHeight: 1.5 }}>
          Toggle Tweaks from the toolbar to hide this panel.
        </div>
      </div>
    </>
  );
};

// ==================== Overview ====================
const OverviewView = ({ D, onNav, onSelect }) => {
  const [hoveredMapId, setHoveredMapId] = React.useState(null);
  const todayCount = D.sessionsByDay[D.sessionsByDay.length - 1];
  const prev = D.sessionsByDay[D.sessionsByDay.length - 8] || 1;
  const weekTrend = Math.round(((D.sessionsByDay.slice(-7).reduce((a, b) => a + b, 0) / 7 - D.sessionsByDay.slice(-14, -7).reduce((a, b) => a + b, 0) / 7) / Math.max(prev, 1)) * 100);

  // Top 5 used
  const topUsed = [...D.all].filter((x) => x.status === 'active').sort((a, b) => b.invocations - a.invocations).slice(0, 5);
  // Unused / issues
  const issues = D.all.filter((x) => x.status === 'error' || x.status === 'missing' || x.status === 'dormant' || x.status === 'inactive');

  const totalInstalled = D.all.length;

  return (
    <>
      <SystemMap D={D} onSelect={onSelect} hoveredId={hoveredMapId} setHoveredId={setHoveredMapId} />

      <div className="hero-grid">
        <HeroChart values={D.sessionsByDay} />
        <div className="hero-cell">
          <div className="hero-label">Installed</div>
          <div className="hero-value">{totalInstalled}</div>
          <div className="hero-sub">
            {D.skills.length} skills · {D.plugins.length} plugins · {D.mcps.length} mcps
          </div>
        </div>
        <div className="hero-cell">
          <div className="hero-label">Sessions · 30d</div>
          <div className="hero-value">{D.totalSessions}</div>
          <div className="hero-sub">
            <span className={weekTrend >= 0 ? 'up' : 'down'}>{weekTrend >= 0 ? '▲' : '▼'} {Math.abs(weekTrend)}% wow</span>
          </div>
        </div>
        <div className="hero-cell">
          <div className="hero-label">Invocations</div>
          <div className="hero-value">{fmtNumBig(D.totalInvocations)}</div>
          <div className="hero-sub">across {D.activeCount} active items</div>
        </div>
      </div>

      {/* Sections grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, border: '1px solid var(--rule)', marginBottom: 32, background: 'var(--paper)' }}>
        {SECTIONS.filter((s) => s.id !== 'overview').map((s, i) => {
          const items = D[s.data] || [];
          const active = items.filter((x) => x.status === 'active').length;
          const totalInvs = items.reduce((a, b) => a + b.invocations, 0);
          return (
            <div
              key={s.id}
              onClick={() => onNav(s.id)}
              style={{
                padding: 22,
                borderRight: i % 3 === 2 ? 'none' : '1px solid var(--rule)',
                borderBottom: i < 3 ? '1px solid var(--rule)' : 'none',
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div className="hero-label" style={{ marginBottom: 0 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>→</div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 6 }}>
                {items.length}
                <span className="hero-count-active">{active} active</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {fmtNumBig(totalInvs)} invocations · 30d
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{SECTION_DESC[s.id]}</div>
            </div>
          );
        })}
      </div>

      {/* Top 5 */}
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-num">01 —</span>
          <span className="section-title-name">Most used</span>
          <span className="section-title-count">top 5 · 30d</span>
        </div>
        <div className="section-desc">The things actually earning their place in your context window.</div>
      </div>
      <EntityTable items={topUsed} selectedId={null} onSelect={onSelect} />

      {/* Quality signal */}
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-num">02 —</span>
          <span className="section-title-name">Helpfulness score</span>
          <span className="section-title-count">leaderboard · 30d</span>
        </div>
        <div className="section-desc">
          Blended signal: CLI ratings from the Session Rater hook + session coverage + invocation volume. Higher = more earned its keep.
        </div>
      </div>
      <HelpfulnessBoard
        items={D.scoreboard}
        onPick={(it) => {
          const ent = D.all.find((x) => x.id === it.id);
          if (ent) onSelect(ent);
        }}
      />

      {/* Unused / issues */}
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-num">03 —</span>
          <span className="section-title-name">Needs attention</span>
          <span className="section-title-count">{issues.length} items</span>
        </div>
        <div className="section-desc">Items that haven't run, are failing, or are missing. Prune or fix.</div>
      </div>
      {issues.length > 0 ? (
        <EntityTable items={issues} selectedId={null} onSelect={onSelect} />
      ) : (
        <div className="empty">Everything looks healthy.</div>
      )}
    </>
  );
};

// ==================== Section View ====================
const SectionView = ({ section, items, filtered, query, setQuery, statusFilter, setStatusFilter, selectedId, onSelect }) => {
  const active = items.filter((x) => x.status === 'active').length;
  const totalInv = items.reduce((a, b) => a + b.invocations, 0);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid var(--rule)', background: 'var(--paper)', marginBottom: 28 }}>
        <div className="hero-cell" style={{ padding: 18 }}>
          <div className="hero-label">Installed</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em' }}>{items.length}</div>
          <div className="hero-sub"><strong className="hero-sub-strong">{active}</strong> active</div>
        </div>
        <div className="hero-cell" style={{ padding: 18 }}>
          <div className="hero-label">Invocations · 30d</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtNumBig(totalInv)}</div>
          <div className="hero-sub">total across section</div>
        </div>
        <div className="hero-cell" style={{ padding: 18, borderRight: 'none' }}>
          <div className="hero-label">Coverage</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {Math.round((active / Math.max(items.length, 1)) * 100)}<span style={{ fontSize: 18, color: 'var(--ink-3)' }}>%</span>
          </div>
          <div className="hero-sub">of items are active</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="search"
          placeholder={`Search ${section.label.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="segmented">
          {['all', 'active', 'dormant', 'error'].map((s) => (
            <button key={s} className={statusFilter === s ? 'on' : ''} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <EntityTable items={filtered} selectedId={selectedId} onSelect={onSelect} />
    </>
  );
};

Object.assign(window, { App });
