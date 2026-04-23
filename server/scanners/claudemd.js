// CLAUDE.md lives at ~/.claude/CLAUDE.md (global) and <project>/CLAUDE.md.

const path = require('path');
const { CLAUDE_HOME, readTextSafe, statSafe } = require('../paths');

function scanClaudeMd() {
  const out = [];
  const candidates = [
    { id: 'claudemd:global', source: '~/.claude/CLAUDE.md', name: 'CLAUDE.md (global)', file: path.join(CLAUDE_HOME, 'CLAUDE.md') },
    { id: 'claudemd:project', source: './CLAUDE.md', name: 'CLAUDE.md (this project)', file: path.join(process.cwd(), 'CLAUDE.md') },
  ];
  for (const c of candidates) {
    const st = statSafe(c.file);
    if (!st) {
      out.push({
        id: c.id,
        _matchKeys: [],
        name: c.name,
        kind: 'claudemd',
        source: c.source,
        status: 'missing',
        installed: null,
        lines: 0,
        summary: 'Not present. Project-specific instructions would be loaded from here if it existed.',
        triggers: [],
        tags: ['instructions', 'missing'],
        examples: [],
      });
      continue;
    }
    const txt = readTextSafe(c.file);
    const lines = txt.split('\n').length;
    const preamble = txt.slice(0, 280).replace(/\s+/g, ' ').trim();
    out.push({
      id: c.id,
      _matchKeys: [],
      name: c.name,
      kind: 'claudemd',
      source: c.source,
      status: 'active',
      installed: st.birthtimeMs || st.ctimeMs,
      lines,
      summary: `Injected into every ${c.id === 'claudemd:global' ? '' : 'matching '}session. First lines: "${preamble}"`,
      triggers: ['auto-loaded on session start'],
      tags: ['instructions', c.id === 'claudemd:global' ? 'global' : 'project'],
      examples: [],
    });
  }
  return out;
}

module.exports = { scanClaudeMd };
