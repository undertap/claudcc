#!/usr/bin/env node

// cc-doctor rating hook. Registered on three events:
//   SessionEnd  → prompt whenever a session ends with any work done
//   PreCompact  → prompt before context compaction (big natural break)
//   Stop        → prompt only when enough work has piled up in a long session
//                 AND the user hasn't already rated this session
//
// Payload arrives on stdin as JSON:
//   { session_id, transcript_path, hook_event_name, ... }
//
// Must exit 0 quickly — Claude Code blocks on the hook.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DOCTOR_HOME, ensureDir, readJsonSafe } = require('../server/paths');
const { saveRating } = require('../server/scanners/ratings');

const RATED_SESSIONS_PATH = path.join(DOCTOR_HOME, 'rated-sessions.json');

const EVT_STOP = 'Stop';
const EVT_SESSION_END = 'SessionEnd';
const EVT_PRE_COMPACT = 'PreCompact';

// Tuned so a quick lookup ("what day is it?") doesn't prompt, but a real
// coding session does.
const STOP_TOOL_USE_THRESHOLD = 10;
const STOP_USER_TURN_THRESHOLD = 5;

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

// Walks the JSONL transcript. For Stop events we can bail the moment
// thresholds are met — transcripts can grow to MB so short-circuiting
// matters on long sessions.
function analyzeTranscript(transcriptPath, shortCircuit) {
  const entities = new Set();
  let toolUseCount = 0;
  let userTurnCount = 0;

  if (!transcriptPath) return { entities: [], toolUseCount, userTurnCount };

  let raw;
  try { raw = fs.readFileSync(transcriptPath, 'utf8'); }
  catch (_) { return { entities: [], toolUseCount, userTurnCount }; }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    const msg = ev.message || ev;
    if (!msg || !msg.role) continue;

    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && block.type === 'tool_use' && block.name) {
          toolUseCount += 1;
          if (block.name.startsWith('mcp__')) {
            const server = block.name.split('__')[1];
            if (server) entities.add('mcp:' + server);
          } else {
            entities.add('tool:' + block.name);
          }
        }
      }
    } else if (msg.role === 'user' && Array.isArray(msg.content)) {
      // A "real" user turn has at least one text block. Pure tool_result
      // messages are the model's own tool loop, not new user input.
      const hasText = msg.content.some((b) => b && b.type === 'text' && b.text && b.text.trim());
      if (hasText) userTurnCount += 1;
    } else if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
      userTurnCount += 1;
    }

    if (shortCircuit && shortCircuit(toolUseCount, userTurnCount)) break;
  }

  return { entities: [...entities], toolUseCount, userTurnCount };
}

function shouldPrompt(eventName, stats) {
  if (stats.toolUseCount === 0) return false;
  if (eventName === EVT_SESSION_END || eventName === EVT_PRE_COMPACT) return true;
  if (eventName === EVT_STOP) {
    return (
      stats.toolUseCount >= STOP_TOOL_USE_THRESHOLD &&
      stats.userTurnCount >= STOP_USER_TURN_THRESHOLD
    );
  }
  return false;
}

function loadRatedSessions() {
  const raw = readJsonSafe(RATED_SESSIONS_PATH, []);
  return new Set(Array.isArray(raw) ? raw : []);
}

function markSessionRated(sessionId, existing) {
  const set = existing || loadRatedSessions();
  set.add(sessionId);
  ensureDir(DOCTOR_HOME);
  fs.writeFileSync(RATED_SESSIONS_PATH, JSON.stringify([...set], null, 2));
}

// Open /dev/tty for input. Claude Code delivers the payload over stdin, so
// by the time we prompt, stdin is closed. /dev/tty is the user's terminal
// regardless of how the subprocess was launched (Unix only — that's fine,
// the Mac desktop app and Linux CLI are our targets).
function prompt(question) {
  return new Promise((resolve) => {
    let ttyFd, inStream;
    try {
      ttyFd = fs.openSync('/dev/tty', 'r');
      inStream = fs.createReadStream(null, { fd: ttyFd });
    } catch (_) {
      resolve('');
      return;
    }
    const rl = readline.createInterface({ input: inStream, output: process.stderr, terminal: true });
    rl.question(question, (ans) => {
      rl.close();
      try { inStream.destroy(); } catch (_) {}
      resolve(ans.trim());
    });
  });
}

async function main() {
  const payload = await readStdinJson();
  const sessionId = payload.session_id || payload.sessionId || null;
  const transcriptPath = payload.transcript_path || payload.transcriptPath;
  const eventName = payload.hook_event_name || payload.hookEventName || EVT_STOP;

  const rated = loadRatedSessions();
  if (sessionId && rated.has(sessionId)) {
    process.exit(0);
  }

  // For Stop, we can bail as soon as thresholds are met — avoids walking
  // the rest of a potentially-huge transcript for no extra information.
  const isStop = eventName === EVT_STOP;
  const stats = analyzeTranscript(
    transcriptPath,
    isStop
      ? (tu, ut) => tu >= STOP_TOOL_USE_THRESHOLD && ut >= STOP_USER_TURN_THRESHOLD
      : null
  );
  if (!shouldPrompt(eventName, stats)) {
    process.exit(0);
  }

  const reasonHint =
    eventName === EVT_PRE_COMPACT ? 'before compaction' :
    eventName === EVT_SESSION_END ? 'session ending' :
    `${stats.toolUseCount} tool uses so far`;

  process.stderr.write('\n\x1b[2m──\x1b[0m  \x1b[1mcc-doctor\x1b[0m  \x1b[2m── ' + reasonHint + '\x1b[0m\n');
  process.stderr.write('Rate this session (1–5, or press Enter to skip): ');

  const raw = await prompt('');

  // Any terminal answer — valid rating, empty skip, or invalid input — means
  // the user has seen the prompt for this session. Don't keep asking.
  const markAndExit = (msg) => {
    if (msg) process.stderr.write(msg);
    if (sessionId) markSessionRated(sessionId, rated);
    process.exit(0);
  };

  if (!raw) return markAndExit('  skipped.\n\n');

  const rating = parseInt(raw, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return markAndExit('  (invalid rating, skipped)\n\n');
  }

  let reason = null;
  if (rating <= 3) {
    reason = await prompt('  What didn\u2019t work? (optional): ');
  }

  saveRating({
    sessionId,
    rating,
    reason: reason || null,
    entities: stats.entities,
    event: eventName,
    toolUseCount: stats.toolUseCount,
    userTurnCount: stats.userTurnCount,
  });
  markAndExit('  logged. Open the dashboard with \x1b[1mnpx cc-doctor\x1b[0m\n\n');
}

main().catch((err) => {
  process.stderr.write('cc-doctor hook error: ' + (err.message || err) + '\n');
  process.exit(0); // never block the session
});
