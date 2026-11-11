import { loadFirebase, friendlyError } from "./index";
import { cleanName } from "../auth/names";

/**
 * Firebase Auth behind the game's auth facade (app/auth/index.js):
 * Google (popup, redirect where popups can't open) and email + password.
 *
 * The name shown on a player's worlds is their Firebase displayName: the one
 * they type on the sign-in screen, else the first word of their Google name
 * (never the email). After changing it the ID token is refreshed, so the
 * functions see the new name.
 */

const SIGNED_IN_BEFORE = "auth_signed_in";

const remember = (signedIn) => {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_BEFORE, "1");
    else localStorage.removeItem(SIGNED_IN_BEFORE);
  } catch (error) {
    // private mode: Firebase still remembers the session
  }
};

const firstName = (name) => cleanName(String(name || "").split(" ")[0]);

const toUser = (user) =>
  user
    ? {
        uid: user.uid,
        displayName: cleanName(user.displayName) || "Player",
        email: user.email || null,
        provider: user.providerData.some((p) => p.providerId === "google.com") ? "google" : "email",
      }
    : null;

const rethrow = (error) => {
  throw new Error(friendlyError(error));
};

async function rename(fb, user, wanted) {
  if (!wanted || wanted === user.displayName) return;
  await fb.authApi.updateProfile(user, { displayName: wanted });
  await user.getIdToken(true);
}

export function firebaseAuthBackend() {
  return {
    mode: "firebase",

    /** Did this device sign in before? Then load Firebase at start to restore it. */
    signedInBefore() {
      try {
        return localStorage.getItem(SIGNED_IN_BEFORE) === "1";
      } catch (error) {
        return false;
      }
    },

    async start(onUser) {
      const fb = await loadFirebase();
      fb.authApi
        .getRedirectResult(fb.auth)
        .then((result) => result && rename(fb, result.user, firstName(result.user.displayName)))
        .then(() => fb.auth.currentUser && onUser(toUser(fb.auth.currentUser)))
        .catch(() => {});
      fb.authApi.onAuthStateChanged(fb.auth, (user) => {
        remember(!!user);
        onUser(toUser(user));
      });
    },

    async signInWithGoogle({ name } = {}) {
      const fb = await loadFirebase().catch(rethrow);
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = fb.authApi;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      let credential;
      try {
        credential = await signInWithPopup(fb.auth, provider);
      } catch (error) {
        if (
          error.code === "auth/popup-blocked" ||
          error.code === "auth/operation-not-supported-in-this-environment"
        ) {
          await signInWithRedirect(fb.auth, provider); // the page reloads signed in
          return null;
        }
        rethrow(error);
      }
      await rename(fb, credential.user, cleanName(name) || firstName(credential.user.displayName));
      remember(true);
      return toUser(fb.auth.currentUser);
    },

    async signInWithEmail({ email, password, name, create }) {
      const fb = await loadFirebase().catch(rethrow);
      const api = fb.authApi;
      try {
        if (create) {
          const credential = await api.createUserWithEmailAndPassword(fb.auth, email, password);
          await rename(fb, credential.user, cleanName(name));
        } else {
          const credential = await api.signInWithEmailAndPassword(fb.auth, email, password);
          await rename(fb, credential.user, cleanName(name));
        }
      } catch (error) {
        rethrow(error);
      }
      remember(true);
      return toUser(fb.auth.currentUser);
    },

    async resetPassword(email) {
      const fb = await loadFirebase().catch(rethrow);
      await fb.authApi.sendPasswordResetEmail(fb.auth, email).catch(rethrow);
    },

    async signOut() {
      remember(false);
      const fb = await loadFirebase();
      await fb.authApi.signOut(fb.auth);
    },
  };
}
