import { firestoreTotals } from "../firebase/totals";
import { boardRows } from "../daily/leaderboard";

/**
 * The combined leaderboard: one all-time score per player, the sum of their
 * best score in each campaign level, each daily challenge and endless mode
 * (functions/src/totals.js). Daily and endless runs count as they are
 * submitted to their own boards; a campaign level is sent here.
 *
 *   totalBoard.load() -> { rows: [{ uid, name, score, rank }], mine: { uid, name, score } | null }
 *   totalBoard.submitCampaign({ level, score, seconds, ticket }) -> { level, best, total }
 *
 * `backend` (app/firebase/totals.js in the game): call(name, data) runs a
 * callable function, board() the getTotalBoard function's answer, { top, me }.
 * Backend errors are passed on as they are; an answer that isn't a board fails
 * like one. The client never sends a name: the server decides it.
 */

const row = (entry) => ({ uid: entry.uid, name: entry.name, score: entry.score });

export function createTotalBoard(backend) {
  return {
    submitCampaign({ level, score, seconds, ticket }) {
      return backend.call("submitCampaignScore", { level, score, seconds, ticket });
    },

    async load() {
      return boardRows(await backend.board(), row);
    },
  };
}

export const totalBoard = createTotalBoard(firestoreTotals);
