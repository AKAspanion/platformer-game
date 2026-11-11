import { firestoreEndless } from "../firebase/endless";

/**
 * Endless mode's global leaderboard: one entry per player, their best run.
 *
 *   board.submit({ seed, level, score, seconds }) -> { rank, total, best, improved }
 *   board.top(limit = 50)                         -> [{ uid, name, level, score, seconds, rank }]
 *   board.mine(uid)                               -> { uid, name, level, score, seconds } | null
 *
 * `backend` (app/firebase/endless.js in the game): call(name, data) runs a
 * callable function, list(limit) the entries best first, get(uid) one entry.
 * Backend errors are passed on as they are, with messages written for
 * players. The client never sends a name: the server decides it.
 */

export const TOP_LIMIT = 50;
/** firestore.rules refuses lists above this. */
const MAX_LIMIT = 100;

const row = (entry) => ({
  uid: entry.uid,
  name: entry.name,
  level: entry.level,
  score: entry.score,
  seconds: entry.seconds,
});

export function createEndlessBoard(backend) {
  return {
    submit({ seed, level, score, seconds }) {
      return backend.call("submitEndlessScore", { seed, level, score, seconds });
    },

    async top(limit = TOP_LIMIT) {
      const count = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || TOP_LIMIT));
      const entries = await backend.list(count);
      return entries.map((entry, i) => ({ ...row(entry), rank: i + 1 }));
    },

    async mine(uid) {
      const entry = await backend.get(uid);
      return entry ? row(entry) : null;
    },
  };
}

export const endlessBoard = createEndlessBoard(firestoreEndless);
