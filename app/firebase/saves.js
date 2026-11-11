import { loadFirebase } from "./index";

/**
 * The cloud save in Firestore, as the plain backend app/progress/cloud.js
 * expects: one document `saves/{uid}` = { v, updatedAt, data }, readable and
 * writable only by its own account (see firestore.rules). Errors propagate;
 * cloud save swallows them.
 */
export const firestoreSaves = {
  async get(uid) {
    const fb = await loadFirebase();
    const { doc, getDoc } = fb.storeApi;
    const snap = await getDoc(doc(fb.db, "saves", uid));
    return snap.exists() ? snap.data() : null;
  },

  async set(uid, save) {
    const fb = await loadFirebase();
    const { doc, setDoc } = fb.storeApi;
    await setDoc(doc(fb.db, "saves", uid), {
      v: save.v,
      updatedAt: save.updatedAt,
      data: save.data,
    });
  },
};
