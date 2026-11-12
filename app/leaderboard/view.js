import { TOP_LIMIT } from "../daily/leaderboard";

/**
 * What the combined leaderboard screen shows for a loaded board: the top three
 * on the podium, every row in rank order (the viewer's marked), and the
 * viewer's own row pinned at the bottom, always: their place on the board,
 * "50+" when they are below the top, or "–" with no score when they have none
 * yet. app/index.js draws it.
 *
 *   totalView({ rows, mine }, uid)
 *     -> { status, podium: [entry | null] x3, rows: [{ entry, me }], mine: { entry, ranked } }
 */

export const TOTAL_EMPTY = "No scores yet. Finish a level to be the first!";
export const NO_RANK = "–";
export const YOU = "You";

export function totalView({ rows, mine }, uid) {
  const shown = rows.map((entry) => ({ entry, me: !!uid && entry.uid === uid }));
  const mineInTop = shown.find((row) => row.me);
  let own;
  if (mineInTop) own = { entry: mineInTop.entry, ranked: true };
  else if (mine && mine.uid === uid)
    own = { entry: { ...mine, rank: `${TOP_LIMIT}+` }, ranked: true };
  else own = { entry: { uid, name: YOU, score: 0, rank: NO_RANK }, ranked: false };
  return {
    status: rows.length ? "" : TOTAL_EMPTY,
    podium: [0, 1, 2].map((i) => rows[i] || null),
    rows: shown,
    mine: own,
  };
}

/** A score short enough for a podium step: 98765, 123.4k, 1.2M (the list shows it whole). */
export function shortScore(score) {
  if (score < 100000) return String(score);
  if (score < 1000000) return `${Math.floor(score / 100) / 10}k`;
  return `${Math.floor(score / 100000) / 10}M`;
}
