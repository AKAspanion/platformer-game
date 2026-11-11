import { firestoreEndless } from "../firebase/endless";
import { boardRows } from "../daily/leaderboard";

/**
 * Endless mode's global leaderboard: one entry per player, their best run.
 *
 *   board.submit({ seed, level, score, seconds, ticket }) -> { rank, total, best, improved }
 *   board.load() -> { rows: [{ uid, name, level, score, seconds, rank }],
 *                     mine: { uid, name, level, score, seconds } | null }
 *
 * `backend` (app/firebase/endless.js in the game): call(name, data) runs a
 * callable function, board() the getEndlessBoard function's answer, { top, me
 * }: the top 50 best first and the caller's own entry (spec 4.4; no client
 * reads the board documents). Backend errors are passed on as they are, with
 * messages written for players; an answer that isn't a board fails like one.
 * The client never sends a name: the server decides it.
 */

const row = (entry) => ({
  uid: entry.uid,
  name: entry.name,
  level: entry.level,
  score: entry.score,
  seconds: entry.seconds,
});

export function createEndlessBoard(backend) {
  return {
    submit({ seed, level, score, seconds, ticket }) {
      return backend.call("submitEndlessScore", { seed, level, score, seconds, ticket });
    },

    async load() {
      return boardRows(await backend.board(), row);
    },
  };
}

export const endlessBoard = createEndlessBoard(firestoreEndless);
