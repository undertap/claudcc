#!/usr/bin/env node

// cc-doctor Stop hook. Claude Code invokes this after each session finishes.
// We ask the user for a 1-5 rating + optional reason, then append the result
// to ~/.cc-doctor/ratings.json (attributed to all tools/MCPs used in the session).
//
// Receives session JSON on stdin:
//   { session_id, transcript_path, hook_event_name, ... }
//
// Must exit 0 quickly — Claude Code blocks on the hook.

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const DOCTOR_HOME = path.join(os.homedir(), '.cc-doctor');
const RATINGS_PATH = path.join(DOCTOR_HOME, 'ratings.json');

function readStdinJson() {
  return new Promise((resolve) => {
    let buf = '';
    const to = setTimeout(() => resolve({}), 500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => { clearTimeout(to); try { resolve(JSON.parse(buf)); } catch { resolve({}); } });
    process.stdin.on('error', () => { clearTimeout(to); resolve({}); });
  });
}

function extractEntities(transcriptPath) {
  const keys = new Set();
  if (!transcriptPath) return [];
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      const msg = ev.message || ev;
      if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && block.type === 'tool_use' && block.name) {
            if (block.name.startsWith('mcp__')) {
              const server = block.name.split('__')[1];
              if (server) keys.add('mcp:' + server);
            } else {
              keys.add('tool:' + block.name);
            }
          }
        }
      }
    }
  } catch (_) {}
  return [...keys];
}

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }

function appendRating(entry) {
  ensureDir(DOCTOR_HOME);
  let current = [];
  try { current = JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8')); } catch (_) {}
  if (!Array.isArray(current)) current = [];
  current.push(entry);
  fs.writeFileSync(RATINGS_PATH, JSON.stringify(current, null, 2));
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function main() {
  const payload = await readStdinJson();
  const sessionId = payload.session_id || payload.sessionId || null;
  const transcriptPath = payload.transcript_path || payload.transcriptPath;

  const entities = extractEntities(transcriptPath);

  // Ask for rating. All prompts go to stderr so they don't pollute stdout
  // (Claude Code reads stdout for hook output in some event types).
  process.stderr.write('\n\x1b[2m──\x1b[0m  \x1b[1mcc-doctor\x1b[0m  \x1b[2m──\x1b[0m\n');
  process.stderr.write('Rate this session (1–5, or press Enter to skip): ');

  const raw = await prompt('');
  if (!raw) {
    process.stderr.write('  skipped.\n\n');
    process.exit(0);
  }
  const rating = parseInt(raw, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    process.stderr.write('  (invalid rating, skipped)\n\n');
    process.exit(0);
  }

  let reason = null;
  if (rating <= 3) {
    reason = await prompt('  What didn’t work? (optional): ');
  }

  appendRating({
    sessionId,
    rating,
    reason: reason || null,
    entities,
    timestamp: new Date().toISOString(),
  });

  process.stderr.write('  logged. Open the dashboard with \x1b[1mnpx cc-doctor\x1b[0m\n\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write('cc-doctor hook error: ' + (err.message || err) + '\n');
  process.exit(0); // never block the session
});
