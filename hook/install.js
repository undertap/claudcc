// `cc-doctor install-hook` / `uninstall-hook` — registers the rating hook
// in ~/.claude/settings.json on three events:
//   Stop        — conditional (only when thresholds met, see rate-session.js)
//   SessionEnd  — always when work has happened
//   PreCompact  — always before compaction
// Idempotent. The Mac desktop app ("Cowork") reads the same settings.json,
// so a single install covers both runtimes.

const fs = require('fs');
const path = require('path');
const { CLAUDE_HOME, readJsonSafe } = require('../server/paths');

const SETTINGS_PATH = path.join(CLAUDE_HOME, 'settings.json');
const HOOK_PATH = path.resolve(__dirname, 'rate-session.js');
const HOOK_COMMAND = `node "${HOOK_PATH}"`;
const HOOK_MARKER = 'cc-doctor:rate-session';
const HOOK_EVENTS = ['Stop', 'SessionEnd', 'PreCompact'];
const BACKUP_KEEP = 5;

function writeSettings(settings) {
  try { fs.mkdirSync(CLAUDE_HOME, { recursive: true }); } catch (_) {}
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

function backup() {
  if (!fs.existsSync(SETTINGS_PATH)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(CLAUDE_HOME, `settings.backup-${stamp}.json`);
  fs.copyFileSync(SETTINGS_PATH, backupPath);
  pruneBackups();
  return backupPath;
}

// Keep the last N settings backups; older ones get collected into /dev/null.
// Prevents the ~/.claude dir from accumulating dozens of files over time.
function pruneBackups() {
  let entries;
  try { entries = fs.readdirSync(CLAUDE_HOME); } catch (_) { return; }
  const backups = entries
    .filter((n) => /^settings\.backup-.*\.json$/.test(n))
    .sort(); // ISO timestamps sort lexicographically
  const excess = backups.length - BACKUP_KEEP;
  for (let i = 0; i < excess; i++) {
    try { fs.unlinkSync(path.join(CLAUDE_HOME, backups[i])); } catch (_) {}
  }
}

function isOurHook(hook) {
  if (!hook) return false;
  return hook._source === HOOK_MARKER || (hook.command || '').includes(HOOK_PATH);
}

function eventHasOurHook(matchers) {
  return (matchers || []).some((m) => (m.hooks || []).some(isOurHook));
}

function installHook() {
  const settings = readJsonSafe(SETTINGS_PATH, {}) || {};
  settings.hooks = settings.hooks || {};

  const alreadyInstalledOn = HOOK_EVENTS.filter((ev) => eventHasOurHook(settings.hooks[ev]));
  if (alreadyInstalledOn.length === HOOK_EVENTS.length) {
    console.log('cc-doctor rate-session hook already installed on all events.');
    return Promise.resolve();
  }

  const bkp = backup();
  for (const ev of HOOK_EVENTS) {
    settings.hooks[ev] = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : [];
    if (eventHasOurHook(settings.hooks[ev])) continue;
    settings.hooks[ev].push({
      matcher: '*',
      hooks: [{ type: 'command', command: HOOK_COMMAND, _source: HOOK_MARKER }],
    });
  }
  writeSettings(settings);

  console.log('Installed cc-doctor rating hook in', SETTINGS_PATH);
  console.log('  Events:', HOOK_EVENTS.join(', '));
  if (bkp) console.log('  Backup saved to', bkp);
  console.log('\nHow it works:');
  console.log('  • SessionEnd / PreCompact  → always prompts when any work happened');
  console.log('  • Stop                     → prompts only after substantial work (≥10 tool uses)');
  console.log('  • Once you rate (or skip), a session is never prompted again.');
  console.log('\nOpen the dashboard anytime with: npx cc-doctor');
  return Promise.resolve();
}

function uninstallHook() {
  const settings = readJsonSafe(SETTINGS_PATH, {}) || {};
  if (!settings.hooks) {
    console.log('No hooks configured; nothing to remove.');
    return Promise.resolve();
  }

  const removedFrom = [];
  for (const ev of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[ev])) continue;
    const before = settings.hooks[ev].length;
    settings.hooks[ev] = settings.hooks[ev]
      .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurHook(h)) }))
      .filter((m) => m.hooks && m.hooks.length > 0);
    if (settings.hooks[ev].length !== before) removedFrom.push(ev);
  }

  if (removedFrom.length === 0) {
    console.log('cc-doctor hook not found in settings.json; nothing to remove.');
    return Promise.resolve();
  }

  const bkp = backup();
  writeSettings(settings);
  console.log('Removed cc-doctor hook from', SETTINGS_PATH);
  console.log('  Cleaned events:', removedFrom.join(', '));
  if (bkp) console.log('  Backup saved to', bkp);
  return Promise.resolve();
}

module.exports = { installHook, uninstallHook, HOOK_PATH };
