// Surface the user's settings.json contents as two entity rows:
// model/defaults and permissions.

const path = require('path');
const { CLAUDE_HOME, readJsonSafe, statSafe } = require('../paths');

function scanSettings() {
  const out = [];
  const userSettingsPath = path.join(CLAUDE_HOME, 'settings.json');
  const userLocalPath = path.join(CLAUDE_HOME, 'settings.local.json');
  const user = readJsonSafe(userSettingsPath) || {};
  const local = readJsonSafe(userLocalPath) || {};
  const stAny = statSafe(userSettingsPath) || statSafe(userLocalPath);

  const modelValues = {};
  for (const key of ['model', 'fastMode', 'maxTokens', 'temperature', 'editor', 'theme', 'autoAcceptEdits', 'apiKeyHelper']) {
    if (user[key] !== undefined) modelValues[key] = user[key];
  }
  out.push({
    id: 'settings:model',
    _matchKeys: [],
    name: 'Model & Defaults',
    kind: 'settings',
    source: '~/.claude/settings.json',
    status: 'active',
    installed: stAny ? (stAny.birthtimeMs || stAny.ctimeMs) : null,
    summary: Object.keys(modelValues).length
      ? `Default model, editor, and session-level defaults.`
      : 'No user-level model defaults configured — Claude Code uses its built-in defaults.',
    values: modelValues,
    triggers: ['every session'],
    tags: ['config'],
    examples: [],
  });

  const perms = (user.permissions || {});
  const localPerms = (local.permissions || {});
  const permValues = {};
  for (const p of (perms.allow || localPerms.allow || [])) permValues[`allow: ${p}`] = true;
  for (const p of (perms.deny || localPerms.deny || [])) permValues[`deny: ${p}`] = true;

  out.push({
    id: 'settings:permissions',
    _matchKeys: [],
    name: 'Permissions',
    kind: 'settings',
    source: Object.keys(perms).length ? '~/.claude/settings.json → permissions' : '~/.claude/settings.local.json → permissions',
    status: Object.keys(permValues).length ? 'active' : 'dormant',
    installed: stAny ? (stAny.birthtimeMs || stAny.ctimeMs) : null,
    summary: Object.keys(permValues).length
      ? `${Object.keys(permValues).length} permission rule${Object.keys(permValues).length === 1 ? '' : 's'} — controls the allow/deny list for tool use.`
      : 'No permission rules configured — every tool prompts by default.',
    values: permValues,
    triggers: ['tool invocation'],
    tags: ['config', 'security'],
    examples: [],
  });

  return out;
}

module.exports = { scanSettings };
