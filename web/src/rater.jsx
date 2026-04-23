// Helpfulness Score view + small helpers.
// Ratings happen in the Claude Code CLI (Session Rater hook asks the user after each session).
// This Mentor app only visualizes the resulting scores.

// ======== Small atoms ========

// Score is 0-100. Color maps: 70+ ink, 40-69 warn, <40 accent(red), null neutral.
const scoreTone = (s) => {
  if (s == null) return 'none';
  if (s >= 70) return 'good';
  if (s >= 40) return 'mid';
  return 'bad';
};

// Big numeric score — used in drawer, leaderboard
const ScorePill = ({ score, size = 'md' }) => {
  const tone = scoreTone(score);
  return (
    <div className={`score-pill score-${size} score-${tone}`}>
      <div className="score-pill-num">{score == null ? '—' : score}</div>
      <div className="score-pill-unit">{score == null ? 'no data' : '/100'}</div>
    </div>
  );
};

// Mini inline score chip — for tables
const ScoreChip = ({ score }) => {
  const tone = scoreTone(score);
  return (
    <div className={`score-chip score-${tone}`}>
      <span className="score-chip-num">{score == null ? '—' : score}</span>
      {score != null && (
        <span className="score-chip-bar">
          <span className="score-chip-fill" style={{ width: `${score}%` }} />
        </span>
      )}
    </div>
  );
};

// Star-ish rating glyph (filled dots 1-5)
const RatingReadout = ({ avg, n }) => {
  if (avg == null || n === 0) {
    return <span className="rating-readout none">not yet rated</span>;
  }
  return (
    <span className="rating-readout">
      <span className="rating-readout-dots">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`rating-readout-dot ${i <= Math.round(avg) ? 'on' : ''}`}
          />
        ))}
      </span>
      <span className="rating-readout-num">{avg.toFixed(1)}</span>
      <span className="rating-readout-n">· {n} rated session{n === 1 ? '' : 's'}</span>
    </span>
  );
};

// ======== Overview: Helpfulness leaderboard ========
const HelpfulnessBoard = ({ items, onPick }) => {
  const kindLabels = { skill: 'SKL', plugin: 'PLG', mcp: 'MCP', hook: 'HK', claudemd: 'MD', setting: 'CFG' };
  return (
    <div className="hboard">
      <div className="hboard-head">
        <div className="hboard-col-rank">#</div>
        <div className="hboard-col-kind">kind</div>
        <div className="hboard-col-name">name</div>
        <div className="hboard-col-score">score</div>
        <div className="hboard-col-rating">avg rating</div>
        <div className="hboard-col-n">rated</div>
      </div>
      <div className="hboard-rows">
        {items.map((it, idx) => {
          const tone = scoreTone(it.score);
          return (
            <div
              key={it.id}
              className="hboard-row"
              onClick={() => onPick && onPick(it)}
            >
              <div className="hboard-col-rank">{String(idx + 1).padStart(2, '0')}</div>
              <div className="hboard-col-kind">{kindLabels[it.kind] || it.kind}</div>
              <div className="hboard-col-name">{it.name}</div>
              <div className="hboard-col-score">
                <div className="hboard-score-bar">
                  <div className={`hboard-score-fill score-${tone}`} style={{ width: `${it.score}%` }} />
                </div>
                <div className={`hboard-score-num score-${tone}`}>{it.score}</div>
              </div>
              <div className="hboard-col-rating">
                <RatingReadout avg={it.avgRating} n={it.ratingN} />
              </div>
              <div className="hboard-col-n">{it.ratingN}</div>
            </div>
          );
        })}
      </div>
      <div className="hboard-foot">
        <span className="hboard-foot-label">formula</span>
        <code className="hboard-foot-code">
          score = 55·(rating/5) + 25·min(1, sessions/62%) + 20·min(1, log10(invocations+1)/2.5)
        </code>
      </div>
    </div>
  );
};

Object.assign(window, { ScorePill, ScoreChip, RatingReadout, HelpfulnessBoard, scoreTone });
