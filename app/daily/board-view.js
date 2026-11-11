import { TOP_LIMIT } from "./leaderboard.js";

/**
 * What the leaderboard screen shows for a loaded board, either tab (the
 * fixes-and-leaderboards spec): the top rows in rank order with the viewer's
 * marked, and the viewer's own entry pinned last as "50+" when it is outside
 * the top. app/index.js draws it.
 *
 *   boardView({ rows, mine }, uid)
 *     -> { status, rows: [{ entry, me, pinned }] }   status "" or BOARD_EMPTY
 */

export const BOARD_EMPTY = "No scores yet. Be the first!";
/** Shown, with Try again, when the board can't load. */
export const BOARD_FAILED = "Leaderboard didn't load.";

export function boardView({ rows, mine }, uid) {
  const inTop = rows.some((row) => row.uid === uid);
  const pinned = !inTop && mine && mine.uid === uid ? mine : null;
  if (!rows.length && !pinned) return { status: BOARD_EMPTY, rows: [] };
  const shown = rows.map((entry) => ({ entry, me: entry.uid === uid, pinned: false }));
  if (pinned) {
    // outside the top 50: the exact place isn't known here, and a stale one would be wrong
    shown.push({ entry: { ...pinned, rank: `${TOP_LIMIT}+` }, me: true, pinned: true });
  }
  return { status: "", rows: shown };
}
