// Plugins live under ~/.claude/plugins/marketplaces/<marketplace>/<plugin>/
// with a plugin.json / package.json describing them.

const path = require('path');
const { CLAUDE_HOME, listDirSafe, readJsonSafe, readTextSafe, statSafe } = require('../paths');

function scanPlugins() {
  const out = [];
  const root = path.join(CLAUDE_HOME, 'plugins', 'marketplaces');
  for (const mp of listDirSafe(root)) {
    if (!mp.isDirectory()) continue;
    const mpPath = path.join(root, mp.name);
    for (const plug of listDirSafe(mpPath)) {
      if (!plug.isDirectory()) continue;
      const plugPath = path.join(mpPath, plug.name);
      const st = statSafe(plugPath);

      const manifest =
        readJsonSafe(path.join(plugPath, 'plugin.json')) ||
        readJsonSafe(path.join(plugPath, 'package.json')) ||
        {};
      const readme =
        readTextSafe(path.join(plugPath, 'README.md')) ||
        readTextSafe(path.join(plugPath, 'readme.md'));
      const firstPara = readme ? readme.replace(/^#[^\n]*\n/, '').split(/\n\s*\n/)[0].replace(/\s+/g,' ').trim().slice(0, 400) : '';

      out.push({
        id: `plugin:${mp.name}/${plug.name}`,
        _matchKeys: [`plugin:${plug.name}`],
        name: manifest.name || plug.name,
        kind: 'plugin',
        source: `${mp.name}/${plug.name}${manifest.version ? '@' + manifest.version : ''}`,
        status: 'active',
        installed: st ? (st.birthtimeMs || st.ctimeMs) : null,
        summary: manifest.description || firstPara || 'No description provided.',
        triggers: [],
        tags: ['plugin', mp.name],
        tools: [],
        examples: [],
      });
    }
  }
  return out;
}

module.exports = { scanPlugins };
