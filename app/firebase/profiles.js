import { loadFirebase } from "./index";
import { PROFILE_BATCH } from "../profiles/rules";

/**
 * Player profiles in Firestore, as the plain backend app/profiles/index.js
 * expects: one document `players/{uid}` = { skin, hat, companion, seenDay? },
 * readable by anyone signed in, writable only by its own account (see
 * firestore.rules). Errors propagate; app/profiles swallows or surfaces them.
 */
export const firestoreProfiles = {
  /** A full replace (no merge), so a removed seenDay really goes. */
  async set(uid, profile) {
    const fb = await loadFirebase();
    const { doc, setDoc } = fb.storeApi;
    await setDoc(doc(fb.db, "players", uid), profile);
  },

  /** One query per call; the caller batches (uids.length <= PROFILE_BATCH). */
  async getMany(uids) {
    if (uids.length === 0) return [];
    const fb = await loadFirebase();
    const { collection, documentId, getDocs, limit, query, where } = fb.storeApi;
    const snap = await getDocs(
      query(
        collection(fb.db, "players"),
        where(documentId(), "in", uids.slice(0, PROFILE_BATCH)),
        limit(PROFILE_BATCH),
      ),
    );
    return snap.docs.map((d) => ({ uid: d.id, data: d.data() }));
  },
};
