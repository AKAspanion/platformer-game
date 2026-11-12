import { TOP_LIMIT } from "../daily/leaderboard";

/**
 * What the combined leaderboard screen shows for a loaded board: every row in
 * rank order (the viewer's marked), and the
 * viewer's own row pinned at the bottom, always: their place on the board,
 * "50+" when they are below the top, or "–" with no score when they have none
 * yet. app/index.js draws it.
 *
 *   totalView({ rows, mine }, uid)
 *     -> { status, rows: [{ entry, me }], mine: { entry, ranked } }
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
    rows: shown,
    mine: own,
  };
}
