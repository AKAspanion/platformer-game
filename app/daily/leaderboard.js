import { firestoreDaily } from "../firebase/daily";

/**
 * The daily challenge's global leaderboard.
 *
 *   leaderboard.submit({ seed, score, seconds })  -> { rank, total, best, improved }
 *   leaderboard.top(seed, limit = 50)             -> [{ uid, name, score, seconds, rank }]
 *   leaderboard.mine(seed, uid)                   -> { uid, name, score, seconds } | null
 *
 * `backend` (app/firebase/daily.js in the game): call(name, data) runs a
 * callable function, list(seed, limit) the day's entries best first, get(seed,
 * uid) one entry. Backend errors are passed on as they are, with messages
 * written for players. The client never sends a name: the server decides it.
 */

export const TOP_LIMIT = 50;
/** firestore.rules refuses lists above this. */
const MAX_LIMIT = 100;

const row = (entry) => ({
  uid: entry.uid,
  name: entry.name,
  score: entry.score,
  seconds: entry.seconds,
});

export function createLeaderboard(backend) {
  return {
    submit({ seed, score, seconds }) {
      return backend.call("submitDailyScore", { seed, score, seconds });
    },

    async top(seed, limit = TOP_LIMIT) {
      const count = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || TOP_LIMIT));
      const entries = await backend.list(seed, count);
      return entries.map((entry, i) => ({ ...row(entry), rank: i + 1 }));
    },

    async mine(seed, uid) {
      const entry = await backend.get(seed, uid);
      return entry ? row(entry) : null;
    },
  };
}

export const leaderboard = createLeaderboard(firestoreDaily);
