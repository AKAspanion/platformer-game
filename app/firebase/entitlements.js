import { loadFirebase } from "./index";

/**
 * The signed-in player's entitlements, entitlements/{uid} = { premium: true }. The
 * developer sets them in the Firebase console (README, "Premium"); a player can read
 * only their own (firestore.rules), and the designWorld function checks the same doc.
 * Errors propagate; app/util/premium.js keeps the last known answer.
 */
export const firestoreEntitlements = {
  async premium(uid) {
    const fb = await loadFirebase();
    const { doc, getDoc } = fb.storeApi;
    const snap = await getDoc(doc(fb.db, "entitlements", uid));
    return snap.exists() && snap.get("premium") === true;
  },
};
