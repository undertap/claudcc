// MCP servers are declared in settings.json (user or project) under
// `mcpServers`. Each entry has a command (stdio) or url (http).

const path = require('path');
const fs = require('fs');
const { CLAUDE_HOME, readJsonSafe, statSafe } = require('../paths');

function readMcpFromSettings(filePath, sourceLabel) {
  const json = readJsonSafe(filePath);
  if (!json) return [];
  const servers = json.mcpServers || (json.mcp && json.mcp.servers) || {};
  const out = [];
  for (const [name, cfg] of Object.entries(servers)) {
    const transport = cfg.url ? 'http' : 'stdio';
    const endpoint = cfg.url
      ? cfg.url
      : [cfg.command, ...(cfg.args || [])].filter(Boolean).join(' ');
    out.push({
      id: `mcp:${name}`,
      _matchKeys: [`mcp:${name}`],
      name,
      kind: 'mcp',
      source: `${sourceLabel} (${transport})`,
      endpoint,
      status: 'active', // health is determined later (auth cache, session errors)
      installed: null,
      summary: cfg.description || `MCP server (${transport}).`,
      triggers: [],
      tags: ['mcp', transport],
      tools: [],
      examples: [],
      _transport: transport,
    });
  }
  return out;
}

function applyAuthHealth(mcps) {
  // ~/.claude/mcp-needs-auth-cache.json lists MCPs that need re-auth.
  const authCache = readJsonSafe(path.join(CLAUDE_HOME, 'mcp-needs-auth-cache.json')) || {};
  const needsAuth = authCache.needs_auth || authCache.needsAuth || [];
  if (!Array.isArray(needsAuth)) return;
  for (const m of mcps) {
    const name = m.name;
    if (needsAuth.some((n) => String(n).toLowerCase() === name.toLowerCase())) {
      m.status = 'error';
      m.tags = Array.from(new Set([...m.tags, 'auth-error']));
    }
  }
}

function scanMcps() {
  const all = [
    ...readMcpFromSettings(path.join(CLAUDE_HOME, 'settings.json'), '~/.claude/settings.json'),
    ...readMcpFromSettings(path.join(CLAUDE_HOME, '.claude.json'), '~/.claude/.claude.json'),
    ...readMcpFromSettings(path.join(process.cwd(), '.claude', 'settings.json'), './.claude/settings.json'),
    ...readMcpFromSettings(path.join(process.cwd(), '.mcp.json'), './.mcp.json'),
  ];
  // Dedupe by id
  const seen = new Set();
  const deduped = all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  applyAuthHealth(deduped);
  return deduped;
}

module.exports = { scanMcps };
