// Orchestrator: runs each scanner, merges in session-log usage metrics and
// user ratings, computes scores, and produces the snapshot the frontend eats.

const { scanSkills } = require('./scanners/skills');
const { scanPlugins } = require('./scanners/plugins');
const { scanMcps } = require('./scanners/mcp');
const { scanHooks } = require('./scanners/hooks');
const { scanClaudeMd } = require('./scanners/claudemd');
const { scanSettings } = require('./scanners/settings');
const { scanSessions, DAYS } = require('./scanners/sessions');
const { aggregateRatings } = require('./scanners/ratings');
const { computeScore } = require('./score');
const { daysAgoLabel, isoDate, zeros } = require('./paths');

function attachUsage(entity, sessionAgg, totalSessions, ratingsByKey) {
  // Merge invocation counts / sparkline per match key, then union session IDs
  // across keys so we don't double-count a session that used multiple keys.
  let invocations = 0;
  let lastUsed = 0;
  let spark = zeros(DAYS);
  let ratingSum = 0;
  let ratingN = 0;
  const sessionIds = new Set();

  const keys = entity._matchKeys || [];
  for (const k of keys) {
    const u = sessionAgg.entities[k];
    if (u) {
      invocations += u.invocations;
      if (u.sessionIds) for (const id of u.sessionIds) sessionIds.add(id);
      lastUsed = Math.max(lastUsed, u.lastUsed);
    }
    const s = sessionAgg.sparks[k];
    if (s) spark = spark.map((v, i) => v + s[i]);
    const r = ratingsByKey[k];
    if (r && r.n) {
      ratingSum += r.avg * r.n;
      ratingN += r.n;
    }
  }
  const sessions = sessionIds.size;

  entity.invocations = invocations;
  entity.sessions = sessions;
  entity.lastUsed = lastUsed ? daysAgoLabel(lastUsed) : (entity.status === 'missing' ? '—' : 'never');
  entity.pctOfSessions = totalSessions ? Math.round((sessions / totalSessions) * 100) : 0;
  entity.avgLatency = '—';
  entity.tokensTotal = 0;
  entity.spark = spark;
  entity.sessionsTrend = '';
  entity.avgRating = ratingN ? ratingSum / ratingN : null;
  entity.ratingN = ratingN;
  entity.installed = entity.installed ? isoDate(entity.installed) : '—';
  entity.triggers = entity.triggers || [];
  entity.tags = entity.tags || [];
  entity.examples = entity.examples || [];

  // Auto-mark dormant if zero invocations and zero ratings, but not error/missing.
  if (
    entity.status === 'active' &&
    invocations === 0 &&
    ratingN === 0 &&
    entity.kind !== 'claudemd' &&
    entity.kind !== 'settings'
  ) {
    entity.status = 'dormant';
  }

  entity.score = computeScore(entity);
  delete entity._matchKeys;
}

async function buildSnapshot() {
  const today = Date.now();

  const [skills, plugins, mcps, hooks, claudemds, settings, sessionAgg, ratingsAgg] = await Promise.all([
    Promise.resolve(scanSkills()),
    Promise.resolve(scanPlugins()),
    Promise.resolve(scanMcps()),
    Promise.resolve(scanHooks()),
    Promise.resolve(scanClaudeMd()),
    Promise.resolve(scanSettings()),
    scanSessions(today),
    Promise.resolve(aggregateRatings()),
  ]);

  const totalSessions = sessionAgg.sessions.total;
  const ratingsByKey = ratingsAgg.byKey;

  for (const e of skills) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);
  for (const e of plugins) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);
  for (const e of mcps) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);
  for (const e of hooks) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);
  for (const e of claudemds) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);
  for (const e of settings) attachUsage(e, sessionAgg, totalSessions, ratingsByKey);

  // CLAUDE.md and settings are "always on" — if a session happened, they were loaded.
  for (const e of [...claudemds, ...settings]) {
    if (e.status === 'active') {
      e.sessions = totalSessions;
      e.invocations = totalSessions;
      e.pctOfSessions = totalSessions ? 100 : 0;
      e.lastUsed = totalSessions ? 'every session' : 'never';
      e.score = computeScore(e);
    }
  }

  const all = [...skills, ...plugins, ...mcps, ...hooks, ...claudemds, ...settings];

  const scoreboard = all
    .filter((e) => e.score != null)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      score: e.score,
      avgRating: e.avgRating,
      ratingN: e.ratingN,
      sessions: e.sessions,
    }))
    .sort((a, b) => b.score - a.score);

  const activeCount = all.filter((x) => x.status === 'active').length;
  const dormantCount = all.filter((x) => x.status === 'dormant' || x.status === 'inactive').length;
  const errorCount = all.filter((x) => x.status === 'error' || x.status === 'missing').length;
  const totalInvocations = all.reduce((s, x) => s + (x.invocations || 0), 0);

  return {
    today: new Date(today).toISOString(),
    DAYS,
    totalSessions,
    totalInvocations,
    totalRated: ratingsAgg.totalRated,
    activeCount,
    dormantCount,
    errorCount,
    sessionsByDay: sessionAgg.sessionsByDay,
    skills,
    plugins,
    mcps,
    hooks,
    claudemds,
    settings,
    all,
    scoreboard,
  };
}

module.exports = { buildSnapshot };
