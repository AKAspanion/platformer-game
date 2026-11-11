import { loadFirebase, friendlyError } from "./index";

/**
 * The endless leaderboard's callable functions, as the plain backend
 * app/modes/endless-board.js expects. No client reads the board documents
 * (firestore.rules: Firestore would hand every reader their create and update
 * times): the board comes from the getEndlessBoard function, and runs are
 * written only by the submitEndlessScore function (functions/index.js).
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

export const firestoreEndless = {
  call,

  /** getEndlessBoard: { top, me }, the top 50 best first and the caller's own entry. */
  board: () => call("getEndlessBoard", {}),
};
