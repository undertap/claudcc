// Parses ~/.claude/projects/<encoded-path>/<session-id>.jsonl
// Produces per-entity invocation + session counts, last-used timestamps,
// and daily sparkline buckets for the last N days.
//
// Each JSONL line is an event. We care mostly about assistant tool_use
// entries (to count invocations) and overall session start/end (to count
// sessions). The shape has evolved across Claude Code versions; this
// scanner is deliberately forgiving.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { CLAUDE_HOME, DAYS, listDirSafe, statSafe } = require('../paths');

function dayIndex(ts, today) {
  // Returns 0..DAYS-1 where DAYS-1 is today; older = smaller index.
  // Anything older than DAYS returns -1.
  const d = new Date(ts);
  const t = new Date(today);
  const diff = Math.floor((t.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff < 0 || diff >= DAYS) return -1;
  return DAYS - 1 - diff;
}

async function parseSessionFile(filePath, today, agg) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    stream.on('error', () => resolve()); // swallow per-file errors
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const sessionId = path.basename(filePath, '.jsonl');
    let sessionStart = null;
    let sessionEnd = null;
    const invocationsHere = {}; // entityKey -> count
    const entitiesInSession = new Set();

    rl.on('line', (line) => {
      if (!line) return;
      let ev;
      try { ev = JSON.parse(line); } catch (_) { return; }

      const ts = ev.timestamp || ev.ts || ev.created_at;
      const tsMs = ts ? Date.parse(ts) : null;
      if (tsMs) {
        if (!sessionStart || tsMs < sessionStart) sessionStart = tsMs;
        if (!sessionEnd || tsMs > sessionEnd) sessionEnd = tsMs;
      }

      // Extract tool_use events from assistant messages.
      const msg = ev.message || ev;
      const role = msg.role || ev.type;
      if (role === 'assistant' && msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && block.type === 'tool_use' && block.name) {
            trackTool(block.name, block.input, tsMs);
          }
        }
      } else if (ev.type === 'tool_use' && ev.name) {
        trackTool(ev.name, ev.input, tsMs);
      }
    });

    function trackTool(toolName, input, tsMs) {
      // Tool names in Claude Code have patterns:
      //   - Plain name (Bash, Read, Edit, Skill, etc.) — built-in
      //   - mcp__<server>__<tool> — MCP server
      //   - `Skill` tool's input.skill / input.name names the actual skill
      const keys = [];
      if (toolName.startsWith('mcp__')) {
        const parts = toolName.split('__');
        const server = parts[1];
        if (server) keys.push(`mcp:${server}`);
      } else if (toolName === 'Skill' && input && (input.skill || input.name)) {
        keys.push(`skill:${input.skill || input.name}`);
        keys.push('tool:Skill');
      } else {
        keys.push(`tool:${toolName}`);
      }
      for (const k of keys) {
        invocationsHere[k] = (invocationsHere[k] || 0) + 1;
        entitiesInSession.add(k);
        if (tsMs) {
          const idx = dayIndex(tsMs, today);
          if (idx >= 0) {
            if (!agg.sparks[k]) agg.sparks[k] = Array(DAYS).fill(0);
            agg.sparks[k][idx]++;
          }
        }
      }
    }

    rl.on('close', () => {
      // Flush per-session counts into the aggregate.
      agg.sessions.total++;
      agg.sessions.ids.add(sessionId);
      if (sessionStart) {
        const idx = dayIndex(sessionStart, today);
        if (idx >= 0) agg.sessionsByDay[idx]++;
      }
      if (sessionEnd) {
        agg.lastSessionEnd = Math.max(agg.lastSessionEnd || 0, sessionEnd);
      }
      for (const [k, n] of Object.entries(invocationsHere)) {
        if (!agg.entities[k]) agg.entities[k] = { invocations: 0, sessionIds: new Set(), lastUsed: 0 };
        agg.entities[k].invocations += n;
        agg.entities[k].sessionIds.add(sessionId);
        if (sessionEnd) agg.entities[k].lastUsed = Math.max(agg.entities[k].lastUsed, sessionEnd);
      }
      resolve();
    });
  });
}

async function scanSessions(today = Date.now()) {
  const agg = {
    sessions: { total: 0, ids: new Set() },
    sessionsByDay: Array(DAYS).fill(0),
    lastSessionEnd: 0,
    entities: {}, // key -> { invocations, sessions, lastUsed }
    sparks: {},   // key -> [DAYS]
  };

  const projectsDir = path.join(CLAUDE_HOME, 'projects');
  const projectDirs = listDirSafe(projectsDir).filter((d) => d.isDirectory());

  // Cap files per project to keep first-load quick on heavy users.
  // Users with very old sessions (> DAYS) contribute nothing to sparklines
  // but we still count them in totals.
  const MAX_FILES_PER_PROJECT = 500;

  for (const dirent of projectDirs) {
    const projPath = path.join(projectsDir, dirent.name);
    const files = listDirSafe(projPath)
      .filter((f) => f.isFile() && f.name.endsWith('.jsonl'))
      .map((f) => {
        const full = path.join(projPath, f.name);
        const st = statSafe(full);
        return { full, mtime: st ? st.mtimeMs : 0 };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, MAX_FILES_PER_PROJECT);

    for (const { full } of files) {
      try { await parseSessionFile(full, today, agg); }
      catch (e) { /* keep going */ }
    }
  }

  return agg;
}

module.exports = { scanSessions, DAYS };
