import { firestoreDaily } from "../firebase/daily.js";

/**
 * The daily challenge's global leaderboard.
 *
 *   leaderboard.submit({ seed, score, seconds, ticket }) -> { rank, total, best, improved }
 *   leaderboard.load(seed) -> { rows: [{ uid, name, score, seconds, rank }],
 *                               mine: { uid, name, score, seconds } | null }
 *
 * `backend` (app/firebase/daily.js in the game): call(name, data) runs a
 * callable function, board(seed) the getDailyBoard function's answer, { top,
 * me }: the day's top 50 best first and the caller's own entry (spec 4.4; no
 * client reads the board documents). Backend errors are passed on as they are,
 * with messages written for players; an answer that isn't a board fails like
 * one. The client never sends a name: the server decides it.
 */

export const TOP_LIMIT = 50;

const row = (entry) => ({
  uid: entry.uid,
  name: entry.name,
  score: entry.score,
  seconds: entry.seconds,
});

const isEntry = (entry) => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry);

/** getDailyBoard's answer as rows and mine; anything else throws, as a failed load. */
export function boardRows(answer, toRow = row) {
  const shaped =
    isEntry(answer) &&
    Array.isArray(answer.top) &&
    answer.top.every(isEntry) &&
    (answer.me === null || answer.me === undefined || isEntry(answer.me));
  if (!shaped) {
    throw Object.assign(new Error("Leaderboard didn't load."), { code: "bad-answer" });
  }
  return {
    rows: answer.top.slice(0, TOP_LIMIT).map((entry, i) => ({ ...toRow(entry), rank: i + 1 })),
    mine: answer.me ? toRow(answer.me) : null,
  };
}

export function createLeaderboard(backend) {
  return {
    submit({ seed, score, seconds, ticket }) {
      return backend.call("submitDailyScore", { seed, score, seconds, ticket });
    },

    async load(seed) {
      return boardRows(await backend.board(seed));
    },
  };
}

export const leaderboard = createLeaderboard(firestoreDaily);
