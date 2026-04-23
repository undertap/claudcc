// Plugins come from two separate Claude runtimes:
//
// 1. CLI ("Claude Code"):
//      ~/.claude/plugins/marketplaces/<marketplace>/<plugin>/
//      or nested <marketplace>/{plugins,external_plugins}/<plugin>/
//    Installed set = ~/.claude/settings.json → enabledPlugins
//                  + ~/.claude/plugins/config.json → repositories
//
// 2. Mac desktop app ("Cowork" / local-agent-mode):
//      ~/Library/Application Support/Claude/local-agent-mode-sessions/
//          <account>/<workspace>/cowork_plugins/
//              .install-manifests/<name>@<marketplace>.json  ← installed registry
//              marketplaces/<marketplace>/<plugin>/          ← plugin files

const path = require('path');
const {
  CLAUDE_HOME,
  COWORK_HOME,
  listDirSafe,
  readJsonSafe,
  readTextSafe,
  statSafe,
} = require('../paths');

const CONTAINER_DIRS = new Set(['plugins', 'external_plugins']);
const SKIP_DIRS = new Set(['.claude-plugin', '.git', 'node_modules']);

function loadEnabledPluginKeys() {
  const keys = new Set();
  const add = (name, marketplace) => {
    if (!name) return;
    keys.add(name);
    if (marketplace) keys.add(`${name}@${marketplace}`);
  };

  const settings = readJsonSafe(path.join(CLAUDE_HOME, 'settings.json')) || {};
  const ep = settings.enabledPlugins;
  if (ep && typeof ep === 'object' && !Array.isArray(ep)) {
    for (const [k, v] of Object.entries(ep)) {
      if (!v) continue;
      const [name, marketplace] = k.split('@');
      add(name, marketplace);
    }
  } else if (Array.isArray(ep)) {
    for (const k of ep) {
      const [name, marketplace] = String(k).split('@');
      add(name, marketplace);
    }
  }

  const pluginsCfg = readJsonSafe(path.join(CLAUDE_HOME, 'plugins', 'config.json')) || {};
  for (const [repoKey, entry] of Object.entries(pluginsCfg.repositories || {})) {
    const [nameFromKey, marketplaceFromKey] = repoKey.split('@');
    add(nameFromKey, marketplaceFromKey);
    if (entry && typeof entry === 'object') add(entry.name, entry.marketplace);
  }

  return keys;
}

// Returns the parsed plugin manifest if `dirPath` looks like a plugin, else null.
// Callers pass the manifest straight into makePluginEntry to avoid re-reading.
function readPluginManifest(dirPath) {
  return (
    readJsonSafe(path.join(dirPath, 'plugin.json')) ||
    readJsonSafe(path.join(dirPath, '.claude-plugin', 'plugin.json')) ||
    readJsonSafe(path.join(dirPath, 'package.json')) ||
    null
  );
}

function extractReadmeSummary(plugPath) {
  const readme =
    readTextSafe(path.join(plugPath, 'README.md')) ||
    readTextSafe(path.join(plugPath, 'readme.md'));
  if (!readme) return '';
  return readme
    .replace(/^#[^\n]*\n/, '')
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function makePluginEntry({ runtime, marketplace, container, plugName, plugPath, manifest, installedAt, fileStat }) {
  const mf = manifest || {};
  const st = fileStat || statSafe(plugPath);
  const missing = !st;
  const idSuffix = container ? `${container}/${plugName}` : plugName;

  const tags = ['plugin', marketplace, runtime];
  if (container) tags.push(container);

  const installedTs = installedAt || (st && (st.birthtimeMs || st.ctimeMs)) || null;

  return {
    id: `plugin:${runtime}:${marketplace}/${idSuffix}`,
    _matchKeys: [`plugin:${plugName}`],
    name: mf.name || plugName,
    kind: 'plugin',
    runtime,
    source: `${runtime === 'cowork' ? 'cowork/' : ''}${marketplace}/${idSuffix}${mf.version ? '@' + mf.version : ''}`,
    status: missing ? 'missing' : 'active',
    installed: installedTs,
    summary: mf.description || (missing ? 'Files missing — manifest claims installed but plugin dir is gone.' : extractReadmeSummary(plugPath)) || 'No description provided.',
    triggers: [],
    tags,
    tools: [],
    examples: [],
  };
}

function scanCliPlugins() {
  const enabled = loadEnabledPluginKeys();
  const isEnabled = (name, marketplace) =>
    enabled.has(name) || enabled.has(`${name}@${marketplace}`);

  const out = [];
  const root = path.join(CLAUDE_HOME, 'plugins', 'marketplaces');
  for (const mp of listDirSafe(root)) {
    if (!mp.isDirectory()) continue;
    const mpPath = path.join(root, mp.name);

    for (const entry of listDirSafe(mpPath)) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      const entryPath = path.join(mpPath, entry.name);

      if (CONTAINER_DIRS.has(entry.name)) {
        for (const plug of listDirSafe(entryPath)) {
          if (!plug.isDirectory() || SKIP_DIRS.has(plug.name)) continue;
          if (!isEnabled(plug.name, mp.name)) continue;
          const plugPath = path.join(entryPath, plug.name);
          out.push(makePluginEntry({
            runtime: 'cli',
            marketplace: mp.name,
            container: entry.name,
            plugName: plug.name,
            plugPath,
            manifest: readPluginManifest(plugPath),
          }));
        }
      } else {
        if (!isEnabled(entry.name, mp.name)) continue;
        const manifest = readPluginManifest(entryPath);
        if (!manifest) continue;
        out.push(makePluginEntry({
          runtime: 'cli',
          marketplace: mp.name,
          container: null,
          plugName: entry.name,
          plugPath: entryPath,
          manifest,
        }));
      }
    }
  }
  return out;
}

// Walks every Cowork workspace. `.install-manifests/*.json` is the
// authoritative installed list; we dedupe across workspaces by pluginId.
function scanCoworkPlugins() {
  const byId = new Map();

  for (const account of listDirSafe(COWORK_HOME)) {
    if (!account.isDirectory()) continue;
    const accountPath = path.join(COWORK_HOME, account.name);

    for (const workspace of listDirSafe(accountPath)) {
      if (!workspace.isDirectory()) continue;
      const wsPluginRoot = path.join(accountPath, workspace.name, 'cowork_plugins');
      const manifestsDir = path.join(wsPluginRoot, '.install-manifests');
      const marketplacesDir = path.join(wsPluginRoot, 'marketplaces');

      for (const manifestFile of listDirSafe(manifestsDir)) {
        if (!manifestFile.isFile() || !manifestFile.name.endsWith('.json')) continue;

        // Cheap dedupe: filename already encodes "<name>@<marketplace>", so skip
        // parsing if we've already emitted this pluginId from a prior workspace.
        const filenameId = manifestFile.name.replace(/\.json$/, '');
        if (byId.has(filenameId)) continue;

        const installManifest = readJsonSafe(path.join(manifestsDir, manifestFile.name)) || {};
        const pluginId = installManifest.pluginId || filenameId;
        if (byId.has(pluginId)) continue;

        const [plugName, marketplace] = pluginId.split('@');
        if (!plugName || !marketplace) continue;

        const plugPath = path.join(marketplacesDir, marketplace, plugName);
        const fileStat = statSafe(plugPath);
        const installedAt = installManifest.createdAt ? Date.parse(installManifest.createdAt) : null;

        byId.set(pluginId, makePluginEntry({
          runtime: 'cowork',
          marketplace,
          container: null,
          plugName,
          plugPath,
          manifest: fileStat ? readPluginManifest(plugPath) : null,
          installedAt,
          fileStat,
        }));
      }
    }
  }

  return [...byId.values()];
}

function scanPlugins() {
  return [...scanCliPlugins(), ...scanCoworkPlugins()];
}

module.exports = { scanPlugins };
