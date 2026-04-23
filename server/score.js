// Helpfulness score 0-100. Ported from the design prototype.
// Formula combines: rating quality, session coverage, invocation volume,
// minus a penalty for errors/dormancy.

function computeScore(entity) {
  const status = entity.status;
  const pctOfSessions = entity.pctOfSessions || 0;
  const invocations = entity.invocations || 0;
  const avgRating = entity.avgRating;
  const ratingN = entity.ratingN || 0;

  if (status === 'missing' || status === 'inactive') return null;
  if (status === 'dormant' && invocations === 0 && ratingN === 0) return null;

  if (status === 'error') {
    return Math.max(0, Math.round(((avgRating || 2)) * 10 - 15));
  }

  // Without ratings we score on usage alone, capped lower so the user
  // can see "these have no feedback signal yet".
  const haveRatings = avgRating != null && ratingN > 0;
  const ratingPart = haveRatings ? (avgRating / 5) * 55 : 30; // neutral-good default
  const usagePart = Math.min(25, pctOfSessions * 0.4);
  const invPart = Math.min(20, Math.log10(invocations + 1) * 8);

  const score = Math.round(ratingPart + usagePart + invPart);

  // If there are no ratings at all in the whole system, demote the cap so
  // the user understands the score is usage-only.
  const cap = haveRatings ? 100 : 75;
  return Math.min(cap, Math.max(0, score));
}

module.exports = { computeScore };
