import { loadFirebase, friendlyError } from "./index";

/**
 * The combined leaderboard's callable functions, as the plain backend
 * app/leaderboard/total-board.js expects. No client reads totals/{uid}
 * (firestore.rules): the board comes from the getTotalBoard function, and
 * totals are written only by the submit functions (functions/index.js).
 */

// the code stays on the error: the game tells "offline" from "refused" by it
const asError = (error) => {
  throw Object.assign(new Error(friendlyError(error)), { code: error && error.code });
};

async function call(name, data) {
  const fb = await loadFirebase().catch(asError);
  const callable = fb.functionsApi.httpsCallable(fb.functions, name);
  const result = await callable(data).catch(asError);
  return result.data;
}

export const firestoreTotals = {
  call,

  /** getTotalBoard: { top, me }, the top 50 best first and the caller's own entry. */
  board: () => call("getTotalBoard", {}),
};
