import { loadFirebase } from "./index";

/**
 * The cloud save in Firestore, as the plain backend app/progress/cloud.js
 * expects: one document `saves/{uid}` = { v, updatedAt, data }, readable and
 * writable only by its own account (see firestore.rules). Errors propagate;
 * cloud save swallows them.
 */

/**
 * The one way cloud save writes: a read-merge-write of `saves/{uid}` in a
 * transaction, so no write is built on a save another device has since
 * replaced. `step(save | null)` gives the save to write, or null to write
 * nothing; Firestore runs it again on the newer save when another write lands
 * first, so it must not change anything itself. Resolves with what the last
 * step gave. Offline it rejects, like any read.
 */
export async function updateSave(storeApi, db, uid, step) {
  const { doc, runTransaction } = storeApi;
  const ref = doc(db, "saves", uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const save = step(snap.exists() ? snap.data() : null);
    if (!save) return null;
    const written = { v: save.v, updatedAt: save.updatedAt, data: save.data };
    transaction.set(ref, written);
    return written;
  });
}

export const firestoreSaves = {
  async update(uid, step) {
    const fb = await loadFirebase();
    return updateSave(fb.storeApi, fb.db, uid, step);
  },
};
