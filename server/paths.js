const os = require('os');
const path = require('path');
const fs = require('fs');

const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const DOCTOR_HOME = path.join(os.homedir(), '.cc-doctor');
const COWORK_HOME = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'local-agent-mode-sessions'
);

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (_) {}
}

function readJsonSafe(filePath, fallback = null) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return fallback;
  }
}

function readTextSafe(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return fallback; }
}

function statSafe(filePath) {
  try { return fs.statSync(filePath); }
  catch (_) { return null; }
}

function listDirSafe(dirPath) {
  try { return fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch (_) { return []; }
}

const DAYS = 30;

function zeros(n = DAYS) { return Array.from({ length: n }, () => 0); }

function daysAgoLabel(ts) {
  if (!ts) return 'never';
  const ms = Date.now() - ts;
  if (ms < 0) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const d = Math.floor(hrs / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function isoDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toISOString().slice(0, 10); }
  catch (_) { return '—'; }
}

module.exports = {
  CLAUDE_HOME,
  COWORK_HOME,
  DOCTOR_HOME,
  DAYS,
  ensureDir,
  readJsonSafe,
  readTextSafe,
  statSafe,
  listDirSafe,
  zeros,
  daysAgoLabel,
  isoDate,
};
