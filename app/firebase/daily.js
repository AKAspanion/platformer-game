import { loadFirebase, friendlyError } from "./index";

/**
 * The daily leaderboard in Firestore and its callable function, as the plain
 * backend app/daily/leaderboard.js expects. Reads go straight to Firestore
 * (public, see firestore.rules); scores are written only by the
 * submitDailyScore function (functions/index.js).
 */

const asError = (error) => {
  throw new Error(friendlyError(error));
};

const scoresOf = (fb, seed) => fb.storeApi.collection(fb.db, "daily", String(seed), "scores");

export const firestoreDaily = {
  async call(name, data) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, name);
    const result = await call(data).catch(asError);
    return result.data;
  },

  /** The day's entries, best first: higher score, then the shorter time. */
  async list(seed, count) {
    const fb = await loadFirebase().catch(asError);
    const { query, orderBy, limit, getDocs } = fb.storeApi;
    const top = query(
      scoresOf(fb, seed),
      orderBy("score", "desc"),
      orderBy("seconds", "asc"),
      limit(count),
    );
    const snap = await getDocs(top).catch(asError);
    return snap.docs.map((d) => d.data());
  },

  async get(seed, uid) {
    const fb = await loadFirebase().catch(asError);
    const { doc, getDoc } = fb.storeApi;
    const snap = await getDoc(doc(fb.db, "daily", String(seed), "scores", uid)).catch(asError);
    return snap.exists() ? snap.data() : null;
  },
};
