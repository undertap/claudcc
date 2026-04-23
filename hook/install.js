// `cc-doctor install-hook` / `uninstall-hook` — registers the Stop hook
// in ~/.claude/settings.json. Idempotent.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_HOME, 'settings.json');
const HOOK_PATH = path.resolve(__dirname, 'rate-session.js');
const HOOK_COMMAND = `node "${HOOK_PATH}"`;
const HOOK_MARKER = 'cc-doctor:rate-session';

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch (_) { return {}; }
}

function writeSettings(settings) {
  try { fs.mkdirSync(CLAUDE_HOME, { recursive: true }); } catch (_) {}
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

function backup() {
  if (!fs.existsSync(SETTINGS_PATH)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(CLAUDE_HOME, `settings.backup-${stamp}.json`);
  fs.copyFileSync(SETTINGS_PATH, backupPath);
  return backupPath;
}

function installHook() {
  const settings = readSettings();
  settings.hooks = settings.hooks || {};
  settings.hooks.Stop = Array.isArray(settings.hooks.Stop) ? settings.hooks.Stop : [];

  const already = settings.hooks.Stop.some((m) =>
    (m.hooks || []).some((h) => (h.command || '').includes(HOOK_MARKER + '"') || (h.command || '').includes(HOOK_PATH))
  );
  if (already) {
    console.log('cc-doctor rate-session hook already installed.');
    return Promise.resolve();
  }

  const bkp = backup();
  settings.hooks.Stop.push({
    matcher: '*',
    hooks: [{ type: 'command', command: HOOK_COMMAND, _source: HOOK_MARKER }],
  });
  writeSettings(settings);
  console.log('Installed cc-doctor Stop hook in', SETTINGS_PATH);
  if (bkp) console.log('Backup saved to', bkp);
  console.log('\nFrom now on, Claude Code will prompt you to rate each session.');
  console.log('Open the dashboard anytime with: npx cc-doctor');
  return Promise.resolve();
}

function uninstallHook() {
  const settings = readSettings();
  if (!settings.hooks || !Array.isArray(settings.hooks.Stop)) {
    console.log('No Stop hooks configured; nothing to remove.');
    return Promise.resolve();
  }
  const before = settings.hooks.Stop.length;
  settings.hooks.Stop = settings.hooks.Stop
    .map((m) => ({
      ...m,
      hooks: (m.hooks || []).filter(
        (h) => !(h._source === HOOK_MARKER || (h.command || '').includes(HOOK_PATH))
      ),
    }))
    .filter((m) => m.hooks && m.hooks.length > 0);

  if (settings.hooks.Stop.length === before) {
    console.log('cc-doctor hook not found in settings.json; nothing to remove.');
    return Promise.resolve();
  }
  const bkp = backup();
  writeSettings(settings);
  console.log('Removed cc-doctor Stop hook from', SETTINGS_PATH);
  if (bkp) console.log('Backup saved to', bkp);
  return Promise.resolve();
}

module.exports = { installHook, uninstallHook, HOOK_PATH };
