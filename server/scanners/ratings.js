// Session ratings live at ~/.cc-doctor/ratings.json as an append-only array:
//   [{ sessionId, rating: 1-5, reason?, entities: [keys], timestamp }]
// Each rating is attributed to every entity that was active in that session.

const fs = require('fs');
const path = require('path');
const { DOCTOR_HOME, ensureDir, readJsonSafe } = require('../paths');

const RATINGS_PATH = path.join(DOCTOR_HOME, 'ratings.json');

function loadRatings() {
  return readJsonSafe(RATINGS_PATH, []) || [];
}

function saveRating(entry) {
  ensureDir(DOCTOR_HOME);
  const current = loadRatings();
  current.push({
    sessionId: entry.sessionId || null,
    rating: Math.max(1, Math.min(5, Math.round(entry.rating))),
    reason: entry.reason || null,
    entities: Array.isArray(entry.entities) ? entry.entities : [],
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  fs.writeFileSync(RATINGS_PATH, JSON.stringify(current, null, 2));
  return { ok: true };
}

// Build per-entity rating stats. `entityKey` is one of our _matchKeys
// (e.g. "mcp:linear", "tool:Bash", "skill:my-skill").
function aggregateRatings() {
  const ratings = loadRatings();
  const byKey = {}; // key -> { sum, n }
  for (const r of ratings) {
    for (const k of r.entities || []) {
      if (!byKey[k]) byKey[k] = { sum: 0, n: 0 };
      byKey[k].sum += r.rating;
      byKey[k].n += 1;
    }
  }
  const result = {};
  for (const [k, v] of Object.entries(byKey)) {
    result[k] = { avg: v.n ? v.sum / v.n : null, n: v.n };
  }
  return { byKey: result, totalRated: ratings.length };
}

module.exports = { loadRatings, saveRating, aggregateRatings, RATINGS_PATH };
