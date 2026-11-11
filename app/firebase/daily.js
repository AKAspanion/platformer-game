import { loadFirebase, friendlyError } from "./index";

/**
 * The daily leaderboard's callable functions, as the plain backend
 * app/daily/leaderboard.js expects. No client reads the board documents
 * (firestore.rules: Firestore would hand every reader their create and update
 * times): the board comes from the getDailyBoard function, and scores are
 * written only by the submitDailyScore function (functions/index.js).
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

export const firestoreDaily = {
  call,

  /** getDailyBoard: { top, me }, the day's top 50 best first and the caller's own entry. */
  board: (seed) => call("getDailyBoard", { seed }),
};
