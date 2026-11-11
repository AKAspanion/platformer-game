import { loadFirebase, friendlyError } from "./index";

/**
 * The endless leaderboard in Firestore and its callable function, as the plain
 * backend app/modes/endless-board.js expects. Reads go straight to Firestore
 * (public, see firestore.rules); runs are written only by the
 * submitEndlessScore function (functions/index.js).
 */

// the code stays on the error: the game tells "offline" from "refused" by it
const asError = (error) => {
  throw Object.assign(new Error(friendlyError(error)), { code: error && error.code });
};

export const firestoreEndless = {
  async call(name, data) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, name);
    const result = await call(data).catch(asError);
    return result.data;
  },

  /** The best runs first: higher level, then higher score, then the shorter time. */
  async list(count) {
    const fb = await loadFirebase().catch(asError);
    const { query, collection, orderBy, limit, getDocs } = fb.storeApi;
    const top = query(
      collection(fb.db, "endless"),
      orderBy("level", "desc"),
      orderBy("score", "desc"),
      orderBy("seconds", "asc"),
      limit(count),
    );
    const snap = await getDocs(top).catch(asError);
    return snap.docs.map((d) => d.data());
  },

  async get(uid) {
    const fb = await loadFirebase().catch(asError);
    const { doc, getDoc } = fb.storeApi;
    const snap = await getDoc(doc(fb.db, "endless", uid)).catch(asError);
    return snap.exists() ? snap.data() : null;
  },
};
