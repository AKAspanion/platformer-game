import { loadFirebase } from "./index";
import { PROFILE_BATCH } from "../profiles/rules";

/**
 * Player profiles, as the plain backend app/profiles/index.js expects. Each
 * player writes only its own document `players/{uid}` = { skin, hat,
 * companion, seenDay? } (see firestore.rules). No client reads that collection,
 * the owner included: profiles are read only through the getProfiles function
 * (functions/src/profiles.js), which hands out those four fields and never a
 * document's create or update time. Errors propagate; app/profiles swallows or
 * surfaces them.
 */
export const firestoreProfiles = {
  /** A full replace (no merge), so a removed seenDay really goes. */
  async set(uid, profile) {
    const fb = await loadFirebase();
    const { doc, setDoc } = fb.storeApi;
    await setDoc(doc(fb.db, "players", uid), profile);
  },

  /** One getProfiles call per batch; the caller batches (uids.length <= PROFILE_BATCH). */
  async getMany(uids) {
    if (uids.length === 0) return [];
    const fb = await loadFirebase();
    const call = fb.functionsApi.httpsCallable(fb.functions, "getProfiles");
    const { data } = await call({ uids: uids.slice(0, PROFILE_BATCH) });
    const found = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return Object.keys(found).map((uid) => ({ uid, data: found[uid] }));
  },
};
