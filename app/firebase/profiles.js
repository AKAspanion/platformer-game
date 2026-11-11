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
/**
 * getProfiles' answer, { [uid]: profile }, as rows. Anything else is a failed
 * call, not a board of players with no profile: it throws, so nothing is cached.
 */
export function profileRows(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw Object.assign(new Error("getProfiles gave no profiles"), { code: "bad-answer" });
  }
  return Object.keys(data).map((uid) => ({ uid, data: data[uid] }));
}

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
    // a failed or offline call rejects here, and app/profiles caches nothing for it
    const result = await call({ uids: uids.slice(0, PROFILE_BATCH) });
    return profileRows(result && result.data);
  },
};
