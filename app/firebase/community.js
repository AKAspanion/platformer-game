import { loadFirebase, friendlyError } from "./index";

/**
 * Community counts in Firestore and the callables that change them, as the
 * plain backend app/worlds/community-client.js expects. Reads go straight to
 * Firestore (see firestore.rules); counts are written only by the functions.
 */

// the code stays on the error: the game tells "offline" from "refused" by it
const asError = (error) => {
  throw Object.assign(new Error(friendlyError(error)), { code: error && error.code });
};

const counts = (data) => ({
  plays: Number(data && data.plays) || 0,
  finishes: Number(data && data.finishes) || 0,
  likes: Number(data && data.likes) || 0,
});

/** One document's data, or null when it doesn't exist. */
const read = async (fb, ...path) => {
  const snap = await fb.storeApi.getDoc(fb.storeApi.doc(fb.db, ...path)).catch(asError);
  return snap.exists() ? snap.data() : null;
};

export const firestoreCommunity = {
  async call(name, data) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, name);
    const result = await call(data).catch(asError);
    return result.data;
  },

  async stats(ids) {
    const fb = await loadFirebase().catch(asError);
    const entries = await Promise.all(
      ids.map(async (id) => {
        const data = await read(fb, "worldStats", id);
        return data ? [id, counts(data)] : null;
      }),
    );
    return Object.fromEntries(entries.filter(Boolean));
  },

  /** World ids, highest trend first. */
  async trending(count) {
    const fb = await loadFirebase().catch(asError);
    const { collection, query, orderBy, limit, getDocs } = fb.storeApi;
    const top = query(collection(fb.db, "worldStats"), orderBy("trend", "desc"), limit(count));
    const snap = await getDocs(top).catch(asError);
    return snap.docs.map((d) => d.id);
  },

  async featured() {
    const fb = await loadFirebase().catch(asError);
    const data = await read(fb, "config", "featured");
    return data && typeof data.current === "string" && data.current ? data.current : null;
  },

  /** The ids this account has liked (each like is a document only its account can read). */
  async likedBy(uid, ids) {
    const fb = await loadFirebase().catch(asError);
    const found = await Promise.all(
      ids.map(async (id) => ((await read(fb, "worldLikes", `${id}_${uid}`)) ? id : null)),
    );
    return new Set(found.filter(Boolean));
  },

  /** Each world's totals over `days` (day keys), from its per-day documents. */
  async week(ids, days) {
    const fb = await loadFirebase().catch(asError);
    const entries = await Promise.all(
      ids.map(async (id) => {
        const docs = await Promise.all(days.map((day) => read(fb, "worldStats", id, "days", day)));
        const total = { plays: 0, finishes: 0, likes: 0 };
        docs.forEach((data) => {
          const c = counts(data);
          total.plays += c.plays;
          total.finishes += c.finishes;
          total.likes += c.likes;
        });
        return [id, total];
      }),
    );
    return Object.fromEntries(entries);
  },
};
