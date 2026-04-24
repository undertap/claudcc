// System map v2 — cleaner layout, no label collisions
// Zones (strict, no overlap):
//   TOP       — plugins (row of rectangles floating above the core, not on it)
//   LEFT/RIGHT — skills (two compact arcs, chips only, labels on hover)
//   BOTTOM    — MCPs (fan of satellites with wire connections; labels hang below)
//   FAR BOTTOM — hooks (horizontal strip, nodes only)
//   INSIDE CORE — just the wordmark, nothing else
//   CLAUDE.md  — card docked to the left edge of the core

const W = 1000;
const H = 560;
const CX = W / 2;
const CY = 230;
const CORE_R = 92;

const DENSITY_CAP = { plugins: 6, skills: 12, mcps: 6, hooks: 8 };

const polar = (r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
};

const wirePath = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = 10;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${(mx + nx * off).toFixed(1)} ${(my + ny * off).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

const compress = (arr, cap) => {
  if (arr.length <= cap) return { visible: arr, overflow: 0 };
  return { visible: arr.slice(0, cap - 1), overflow: arr.length - (cap - 1) };
};

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const SystemMap = ({ D, onSelect, hoveredId, setHoveredId }) => {
  const plugins = D.plugins;
  const skills = D.skills;
  const mcps = D.mcps;
  const hooks = D.hooks;

  const pCmp = compress(plugins, DENSITY_CAP.plugins);
  const sCmp = compress(skills, DENSITY_CAP.skills);
  const mCmp = compress(mcps, DENSITY_CAP.mcps);
  const hCmp = compress(hooks, DENSITY_CAP.hooks);

  const dim = (id) => (hoveredId && hoveredId !== id ? 0.18 : 1);
  const isActive = (s) => s === 'active';

  // ============ PLUGINS: a row of rects floating ABOVE the core ============
  // Row Y = CY - CORE_R - 50 (clear of core). Rects in a horizontal line, centered.
  const pluginCount = pCmp.visible.length + (pCmp.overflow ? 1 : 0);
  const pluginW = 128;
  const pluginH = 32;
  const pluginGap = 12;
  const pluginTotalW = pluginCount * pluginW + (pluginCount - 1) * pluginGap;
  const pluginStartX = CX - pluginTotalW / 2;
  const pluginY = CY - CORE_R - 74;

  const pluginNodes = pCmp.visible.map((p, i) => ({
    ...p,
    x: pluginStartX + i * (pluginW + pluginGap),
    y: pluginY,
  }));
  if (pCmp.overflow) {
    pluginNodes.push({
      id: '__more_plugins',
      name: `+${pCmp.overflow} more`,
      x: pluginStartX + pCmp.visible.length * (pluginW + pluginGap),
      y: pluginY,
      overflow: true,
      kind: 'plugin',
    });
  }

  // ============ SKILLS: two compact arcs, LEFT and RIGHT of core ============
  // Split skills in half. Left arc: angles 200°–340° (actually using absolute ±).
  // Using left side 255°–285° and right side 75°–105° is too narrow.
  // Use: left arc angles 250°..290° (40° span), right arc 70°..110°.
  // Radius chosen so chips sit clear of plugins row and hooks strip.
  const SKILL_R = 156;
  const halfN = Math.ceil(sCmp.visible.length / 2);
  const leftSkills = sCmp.visible.slice(0, halfN);
  const rightSkills = sCmp.visible.slice(halfN);
  const overflowOnRight = !!sCmp.overflow;

  const makeSkillArc = (items, startAngle, endAngle, withOverflow = false) => {
    const count = items.length + (withOverflow ? 1 : 0);
    return items.map((s, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = startAngle + (endAngle - startAngle) * t;
      const [x, y] = polar(SKILL_R, a);
      return { ...s, x, y, angle: a };
    });
  };

  // Left side = 240°..300° (60° span centered on 270° = west)
  // Right side = 60°..120° (60° span centered on 90° = east)
  const leftSkillNodes = makeSkillArc(leftSkills, 240, 300);
  const rightSkillNodes = makeSkillArc(rightSkills, 60, 120, overflowOnRight);
  if (overflowOnRight) {
    const count = rightSkills.length + 1;
    const t = count === 1 ? 0.5 : rightSkills.length / (count - 1);
    const a = 60 + (120 - 60) * t;
    const [x, y] = polar(SKILL_R, a);
    rightSkillNodes.push({
      id: '__more_skills',
      name: `+${sCmp.overflow}`,
      x,
      y,
      angle: a,
      overflow: true,
      kind: 'skill',
    });
  }
  const skillNodes = [...leftSkillNodes, ...rightSkillNodes];

  // ============ MCPs: horizontal row below the core, flat baseline ============
  const MCP_Y = CY + CORE_R + 96;
  const mcpCount = mCmp.visible.length + (mCmp.overflow ? 1 : 0);
  const mcpSpan = Math.min(720, W - 160);
  const mcpStartX = CX - mcpSpan / 2;
  const mcpStepX = mcpCount <= 1 ? 0 : mcpSpan / (mcpCount - 1);
  const mcpNodes = mCmp.visible.map((m, i) => {
    const x = mcpCount === 1 ? CX : mcpStartX + i * mcpStepX;
    const y = MCP_Y;
    // Connect from the bottom of the core, angled toward each MCP
    const dx = x - CX;
    const dyFromCore = y - CY;
    const len = Math.sqrt(dx * dx + dyFromCore * dyFromCore) || 1;
    const cx1 = CX + (dx / len) * (CORE_R + 4);
    const cy1 = CY + (dyFromCore / len) * (CORE_R + 4);
    return { ...m, x, y, cx1, cy1 };
  });
  if (mCmp.overflow) {
    const x = mcpStartX + mCmp.visible.length * mcpStepX;
    const y = MCP_Y;
    const dx = x - CX;
    const dyFromCore = y - CY;
    const len = Math.sqrt(dx * dx + dyFromCore * dyFromCore) || 1;
    const cx1 = CX + (dx / len) * (CORE_R + 4);
    const cy1 = CY + (dyFromCore / len) * (CORE_R + 4);
    mcpNodes.push({
      id: '__more_mcps',
      name: `+${mCmp.overflow}`,
      x,
      y,
      cx1,
      cy1,
      overflow: true,
      kind: 'mcp',
    });
  }

  // ============ HOOKS: strip at bottom (pushed well below MCP labels) ============
  const stripY = MCP_Y + 90;
  const stripX1 = 100;
  const stripX2 = W - 100;
  const stripLen = stripX2 - stripX1;
  const hookCount = hCmp.visible.length + (hCmp.overflow ? 1 : 0);
  const hookNodes = hCmp.visible.map((h, i) => {
    const x = stripX1 + (stripLen * (i + 0.5)) / hookCount;
    return { ...h, x, y: stripY };
  });
  if (hCmp.overflow) {
    const x = stripX1 + (stripLen * (hCmp.visible.length + 0.5)) / hookCount;
    hookNodes.push({
      id: '__more_hooks',
      name: `+${hCmp.overflow}`,
      x,
      y: stripY,
      overflow: true,
      kind: 'hook',
    });
  }

  // ============ CLAUDE.md card to the LEFT of core ============
  const claudeMd = D.claudemds.find((c) => c.status === 'active');

  const handleEnter = (id) => setHoveredId(id);
  const handleLeave = () => setHoveredId(null);
  const handleClick = (entity) => {
    if (entity.overflow) return;
    onSelect(entity);
  };

  const hovered =
    hoveredId && [...plugins, ...skills, ...mcps, ...hooks, ...D.claudemds].find((x) => x.id === hoveredId);

  return (
    <div className="system-map-wrap">
      {/* Header strip */}
      <div className="system-map-header">
        <div>
          <div className="system-map-title-label">System map</div>
        </div>
        <div className="system-map-legend">
          <span className="legend-item">
            <span className="legend-shape legend-core" /> core
          </span>
          <span className="legend-item">
            <span className="legend-shape legend-plugin" /> plugin
          </span>
          <span className="legend-item">
            <span className="legend-shape legend-skill" /> skill
          </span>
          <span className="legend-item">
            <span className="legend-shape legend-mcp" /> mcp
          </span>
          <span className="legend-item">
            <span className="legend-shape legend-hook" /> hook
          </span>
          <span className="legend-item legend-sep">
            <span className="legend-dash legend-active" /> active
          </span>
          <span className="legend-item">
            <span className="legend-dash legend-dormant" /> dormant
          </span>
          <span className="legend-item">
            <span className="legend-dash legend-error" /> error
          </span>
        </div>
      </div>

      <svg className="system-map" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="softshadow2" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#141414" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Faint guide arcs (subtle — help the eye group) */}
        <circle cx={CX} cy={CY} r={SKILL_R} fill="none" stroke="var(--rule-softer)" strokeWidth="1" strokeDasharray="2 5" />

        {/* ============ Vertical connector lines from plugin row down to core top ============ */}
        {pluginNodes.map((p) => {
          if (p.overflow) return null;
          const px = p.x + pluginW / 2;
          const py = p.y + pluginH;
          const coreTopX = CX + ((px - CX) / Math.max(Math.abs(px - CX) + 40, 1)) * 0; // roughly straight down to core
          // Draw a short line from plugin bottom center to a point on core top edge
          const dx = px - CX;
          const dist = Math.sqrt(dx * dx + (py - CY) * (py - CY));
          const ratio = CORE_R / dist;
          const toX = CX + dx * ratio;
          const toY = CY + (py - CY) * ratio;
          return (
            <line
              key={`pline-${p.id}`}
              x1={px}
              y1={py}
              x2={toX}
              y2={toY}
              stroke="var(--ink)"
              strokeWidth="0.8"
              strokeDasharray="1 3"
              opacity={dim(p.id) * 0.5}
            />
          );
        })}

        {/* ============ MCP wires ============ */}
        {mcpNodes.map((m, idx) => {
          if (m.overflow) return null;
          const err = m.status === 'error';
          const dormant = m.status !== 'active';
          const isHot = m.status === 'active' && m.lastUsed && (m.lastUsed.includes('min') || m.lastUsed.includes('hour'));
          const pathId = `wire-path-${m.id}`;
          // Path: core → MCP (so mpath flow goes MCP → core with keyPoints reversed)
          const d = wirePath(m.cx1, m.cy1, m.x, m.y);
          return (
            <g key={`wire-${m.id}`} style={{ opacity: dim(m.id) }}>
              {/* base stroke */}
              <path
                id={pathId}
                d={d}
                fill="none"
                stroke={err ? 'var(--bad)' : dormant ? 'var(--ink-4)' : 'var(--ink)'}
                strokeWidth={err ? 1.5 : 1.2}
                strokeDasharray={err ? '4 3' : dormant ? '2 4' : 'none'}
              />
              {/* hot wires: flowing particles (3 staggered), with trail and fade */}
              {isHot && [0, 1, 2].map((pi) => {
                const dur = 2.4;
                const delay = -(pi * dur) / 3; // negative starts animation mid-way
                return (
                  <g key={pi}>
                    {/* trailing halo */}
                    <circle r="5" fill="var(--accent)" opacity="0.18">
                      <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                    </circle>
                    {/* bright particle */}
                    <circle r="2.4" fill="var(--accent)">
                      <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                      <animate
                        attributeName="opacity"
                        dur={`${dur}s`}
                        repeatCount="indefinite"
                        begin={`${delay}s`}
                        values="0;1;1;1;0"
                        keyTimes="0;0.1;0.5;0.9;1"
                      />
                    </circle>
                  </g>
                );
              })}
              {/* error wires: pulsing red dot at core end */}
              {err && (
                <circle cx={m.cx1} cy={m.cy1} r="3" fill="var(--bad)">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
          );
        })}

        {/* ============ CORE ============ */}
        <g style={{ opacity: dim('__core') }}>
          <circle cx={CX} cy={CY} r={CORE_R + 3} fill="none" stroke="var(--ink)" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={CORE_R} fill="var(--ink)" filter="url(#softshadow2)" />
          {/* core label, clean */}
          <text
            x={CX}
            y={CY - 2}
            textAnchor="middle"
            fill="var(--bg)"
            style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.015em' }}
          >
            claude
          </text>
          <text
            x={CX}
            y={CY + 22}
            textAnchor="middle"
            fill="var(--accent)"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            code · v1.8.3
          </text>
        </g>

        {/* ============ CLAUDE.md card — top-left, stacked above plugin row ============ */}
        {claudeMd && (
          <g
            transform={`translate(20, 10)`}
            style={{ cursor: 'pointer', opacity: dim(claudeMd.id) }}
            onMouseEnter={() => handleEnter(claudeMd.id)}
            onMouseLeave={handleLeave}
            onClick={() => handleClick(claudeMd)}
          >
            <rect x="0" y="0" width="150" height="52" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1" />
            <rect x="0" y="0" width="3" height="52" fill="var(--accent)" />
            <text x="14" y="19" fill="var(--ink-3)" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Auto-loaded
            </text>
            <text x="14" y="39" fill="var(--ink)" style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.01em' }}>
              CLAUDE.md
            </text>
          </g>
        )}

        {/* ============ PLUGINS ============ */}
        {pluginNodes.map((p) => {
          const active = isActive(p.status);
          return (
            <g
              key={p.id}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ opacity: dim(p.id), cursor: p.overflow ? 'default' : 'pointer' }}
              onMouseEnter={() => !p.overflow && handleEnter(p.id)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(p)}
            >
              <rect
                x="0"
                y="0"
                width={pluginW}
                height={pluginH}
                fill={p.overflow ? 'var(--bg)' : active ? 'var(--paper)' : 'var(--bg)'}
                stroke={p.overflow ? 'var(--ink-4)' : active ? 'var(--ink)' : 'var(--ink-4)'}
                strokeWidth="1.2"
                strokeDasharray={p.status === 'inactive' && !p.overflow ? '3 3' : 'none'}
                filter={active ? 'url(#softshadow2)' : 'none'}
              />
              {!p.overflow && (
                <rect
                  x="0"
                  y="0"
                  width="3"
                  height={pluginH}
                  fill={active ? 'var(--accent)' : p.status === 'error' ? 'var(--bad)' : 'var(--ink-4)'}
                />
              )}
              <text
                x={pluginW / 2}
                y={pluginH / 2 - 2}
                textAnchor="middle"
                fill={p.overflow ? 'var(--ink-3)' : 'var(--ink)'}
                style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500 }}
              >
                {p.overflow ? p.name : truncate(p.name, 16)}
              </text>
              {!p.overflow && (
                <text
                  x={pluginW / 2}
                  y={pluginH / 2 + 10}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  plugin
                </text>
              )}
            </g>
          );
        })}

        {/* Plugin zone label */}
        <text
          x={CX}
          y={pluginY - 16}
          textAnchor="middle"
          fill="var(--ink-3)"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          ── Plugins ──
        </text>

        {/* ============ SKILLS ============ */}
        {skillNodes.map((s) => {
          const active = isActive(s.status);
          const r = s.overflow ? 14 : 12;
          const isLeft = s.angle > 180;
          const labelX = s.x + (isLeft ? -r - 10 : r + 10);
          const labelY = s.y + 3;
          const isHovered = hoveredId === s.id;
          return (
            <g
              key={s.id}
              style={{ opacity: dim(s.id), cursor: s.overflow ? 'default' : 'pointer' }}
              onMouseEnter={() => !s.overflow && handleEnter(s.id)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(s)}
            >
              {/* hit target */}
              <circle cx={s.x} cy={s.y} r={r + 12} fill="transparent" />
              <circle
                cx={s.x}
                cy={s.y}
                r={r}
                fill={s.overflow ? 'var(--bg)' : active ? 'var(--ink)' : 'var(--bg)'}
                stroke={active ? 'var(--ink)' : 'var(--ink-4)'}
                strokeWidth="1.2"
                strokeDasharray={!active && !s.overflow ? '2 2' : 'none'}
              />
              {active && s.pctOfSessions > 30 && (
                <circle cx={s.x} cy={s.y} r={r - 5} fill="var(--accent)" />
              )}
              {s.overflow && (
                <text
                  x={s.x}
                  y={s.y + 3}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                >
                  {s.name}
                </text>
              )}
              {/* label always visible */}
              {!s.overflow && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={isLeft ? 'end' : 'start'}
                  fill={isHovered ? 'var(--ink)' : 'var(--ink-2)'}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.02em',
                    fontWeight: isHovered ? 600 : 400,
                  }}
                >
                  {truncate(s.name, 18)}
                </text>
              )}
            </g>
          );
        })}

        {/* Skills zone label — single, above the skills ring */}
        <text
          x={CX}
          y={CY - SKILL_R - 14}
          textAnchor="middle"
          fill="var(--ink-3)"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0 }}
        >
          Skills
        </text>

        {/* ============ MCPs ============ */}
        {/* MCP zone label */}
        <text
          x={CX}
          y={MCP_Y - 46}
          textAnchor="middle"
          fill="var(--ink-3)"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          ── MCP servers ──
        </text>
        {mcpNodes.map((m) => {
          const active = isActive(m.status);
          const err = m.status === 'error';
          const size = m.overflow ? 14 : 20;
          return (
            <g
              key={m.id}
              style={{ opacity: dim(m.id), cursor: m.overflow ? 'default' : 'pointer' }}
              onMouseEnter={() => !m.overflow && handleEnter(m.id)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(m)}
            >
              {/* hit target */}
              <circle cx={m.x} cy={m.y} r={size + 10} fill="transparent" />
              <rect
                x={m.x - size}
                y={m.y - size}
                width={size * 2}
                height={size * 2}
                transform={`rotate(45 ${m.x} ${m.y})`}
                fill={m.overflow ? 'var(--bg)' : active ? 'var(--paper)' : err ? 'var(--bad)' : 'var(--bg)'}
                stroke={err ? 'var(--bad)' : active ? 'var(--ink)' : 'var(--ink-4)'}
                strokeWidth="1.2"
                strokeDasharray={!active && !err && !m.overflow ? '3 3' : 'none'}
                filter={active ? 'url(#softshadow2)' : 'none'}
              />
              {err && (
                <text
                  x={m.x}
                  y={m.y + 5}
                  textAnchor="middle"
                  fill="var(--paper)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}
                >
                  !
                </text>
              )}
              {m.overflow && (
                <text
                  x={m.x}
                  y={m.y + 3}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                >
                  {m.name}
                </text>
              )}
              {!m.overflow && !err && active && (
                <circle cx={m.x} cy={m.y} r="3" fill="var(--accent)" />
              )}
              {/* label BELOW diamond */}
              {!m.overflow && (
                <text
                  x={m.x}
                  y={m.y + size + 22}
                  textAnchor="middle"
                  fill="var(--ink)"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {m.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ============ HOOKS STRIP ============ */}
        <g>
          {/* strip line */}
          <line x1={stripX1} y1={stripY} x2={stripX2} y2={stripY} stroke="var(--ink)" strokeWidth="0.8" />
          {/* zone label */}
          <text
            x={stripX1}
            y={stripY - 26}
            fill="var(--ink-3)"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            ── Hooks · lifecycle events ──
          </text>
          {/* hook nodes */}
          {hookNodes.map((h) => {
            const active = isActive(h.status);
            return (
              <g
                key={h.id}
                style={{ opacity: dim(h.id), cursor: h.overflow ? 'default' : 'pointer' }}
                onMouseEnter={() => !h.overflow && handleEnter(h.id)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(h)}
              >
                {/* hit target */}
                <rect x={h.x - 60} y={stripY - 18} width="120" height="36" fill="transparent" />
                {/* tick */}
                <line x1={h.x} y1={stripY - 6} x2={h.x} y2={stripY + 6} stroke={active ? 'var(--ink)' : 'var(--ink-4)'} strokeWidth="1.4" />
                {/* chip below the strip */}
                <rect
                  x={h.x - (h.overflow ? 18 : 56)}
                  y={stripY + 10}
                  width={h.overflow ? 36 : 112}
                  height="20"
                  fill={h.overflow ? 'var(--bg)' : active ? 'var(--paper)' : 'var(--bg)'}
                  stroke={active ? 'var(--ink)' : 'var(--ink-4)'}
                  strokeWidth="1"
                />
                <text
                  x={h.x}
                  y={stripY + 24}
                  textAnchor="middle"
                  fill={h.overflow ? 'var(--ink-3)' : 'var(--ink)'}
                  style={{ fontFamily: h.overflow ? 'var(--font-mono)' : 'var(--font-ui)', fontSize: 10.5, fontWeight: 500 }}
                >
                  {h.overflow ? h.name : truncate(h.name, 18)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating tooltip card */}
      {hovered && <MapTooltip entity={hovered} />}
    </div>
  );
};

const MapTooltip = ({ entity }) => {
  const kindLabel = {
    skill: 'Skill',
    plugin: 'Plugin',
    mcp: 'MCP Server',
    hook: 'Hook',
    claudemd: 'Instructions',
    settings: 'Settings',
  }[entity.kind];
  return (
    <div className="map-tooltip">
      <div className="map-tooltip-kind">
        <span className={`status-dot ${entity.status}`} /> {kindLabel} · {entity.status}
      </div>
      <div className="map-tooltip-name">{entity.name}</div>
      <div className="map-tooltip-summary">{entity.summary}</div>
      <div className="map-tooltip-row">
        <span>{entity.sessions} sessions</span>
        <span>{entity.invocations} invocations</span>
        <span>{entity.lastUsed}</span>
      </div>
      <div className="map-tooltip-hint">click to open detail →</div>
    </div>
  );
};

Object.assign(window, { SystemMap });
