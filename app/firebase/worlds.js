import { loadFirebase, friendlyError } from "./index";

/**
 * The shared worlds in Firestore and the world creator's functions, as the
 * plain adapter app/worlds/repository.js (FirestoreRepository) expects.
 * Reads go straight to Firestore (public, see firestore.rules); writes and
 * AI designs go through the callable functions (functions/index.js).
 */

const asError = (error) => {
  throw new Error(friendlyError(error));
};

const newest = (fb, count) => {
  const { collection, query, orderBy, limit } = fb.storeApi;
  return query(collection(fb.db, "worlds"), orderBy("createdAt", "desc"), limit(count));
};

export const firestoreWorlds = {
  async list(count) {
    const fb = await loadFirebase().catch(asError);
    const snap = await fb.storeApi.getDocs(newest(fb, count)).catch(asError);
    return snap.docs.map((d) => d.data());
  },

  async get(id) {
    const fb = await loadFirebase().catch(asError);
    const snap = await fb.storeApi.getDoc(fb.storeApi.doc(fb.db, "worlds", id)).catch(asError);
    return snap.exists() ? snap.data() : null;
  },

  /** onAdded(raw) for each world added after the call; returns stop(). */
  watch(count, onAdded, onError = () => {}) {
    let stop = null;
    let stopped = false;
    loadFirebase()
      .then((fb) => {
        if (stopped) return;
        let first = true;
        stop = fb.storeApi.onSnapshot(
          newest(fb, count),
          (snap) => {
            if (first) {
              first = false; // what's already there: list() shows it
              return;
            }
            snap.docChanges().forEach((change) => {
              if (change.type === "added") onAdded(change.doc.data());
            });
          },
          onError,
        );
      })
      .catch(onError);
    return () => {
      stopped = true;
      if (stop) stop();
    };
  },

  async publish(world) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, "publishWorld");
    const result = await call({ world }).catch(asError);
    return result.data.world;
  },

  /** Every shared world matching `query` (the searchWorlds function). */
  async search(query) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, "searchWorlds");
    const result = await call({ query }).catch(asError);
    return result.data.worlds;
  },

  async design(prompt) {
    const fb = await loadFirebase().catch(asError);
    const call = fb.functionsApi.httpsCallable(fb.functions, "designWorld", { timeout: 70000 });
    const result = await call({ prompt }).catch(asError);
    return result.data.spec;
  },
};
