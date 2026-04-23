// Hooks live in settings.json under `hooks.<EventName>` as an array of
// matcher objects each with { matcher, hooks: [{ type, command }] }.

const path = require('path');
const { CLAUDE_HOME, readJsonSafe } = require('../paths');

function readHooksFromSettings(filePath, sourceLabel) {
  const json = readJsonSafe(filePath);
  if (!json || !json.hooks) return [];
  const out = [];
  for (const [event, matchers] of Object.entries(json.hooks)) {
    if (!Array.isArray(matchers)) continue;
    matchers.forEach((m, mi) => {
      const matcher = m.matcher || '*';
      const list = Array.isArray(m.hooks) ? m.hooks : [];
      list.forEach((h, hi) => {
        const cmd = h.command || h.type || 'unknown';
        const short = cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd;
        out.push({
          id: `hook:${event}:${mi}:${hi}`,
          _matchKeys: [], // hooks don't map 1:1 to tool calls, usage comes from event count
          name: `${event} · ${matcher}`,
          kind: 'hook',
          source: sourceLabel,
          status: 'active',
          event,
          command: cmd,
          summary: `Runs \`${short}\` on ${event}${matcher !== '*' ? ' matching ' + matcher : ''}.`,
          triggers: [event + (matcher !== '*' ? ' (' + matcher + ')' : '')],
          tags: ['hook', event.toLowerCase()],
          examples: [],
        });
      });
    });
  }
  return out;
}

function scanHooks() {
  return [
    ...readHooksFromSettings(path.join(CLAUDE_HOME, 'settings.json'), '~/.claude/settings.json'),
    ...readHooksFromSettings(path.join(CLAUDE_HOME, 'settings.local.json'), '~/.claude/settings.local.json'),
    ...readHooksFromSettings(path.join(process.cwd(), '.claude', 'settings.json'), './.claude/settings.json'),
    ...readHooksFromSettings(path.join(process.cwd(), '.claude', 'settings.local.json'), './.claude/settings.local.json'),
  ];
}

module.exports = { scanHooks };
