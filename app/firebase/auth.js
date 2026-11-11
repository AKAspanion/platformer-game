import { loadFirebase, friendlyError } from "./index";
import { cleanName } from "../auth/names";

/**
 * Firebase Auth behind the game's auth facade (app/auth/index.js):
 * Google (a full-page redirect, so it works in installed apps and where
 * popups are blocked) and email + password, plus anonymous players (the
 * daily challenge's leaderboard).
 *
 * An anonymous player who signs in with Google or creates an email account
 * has that sign-in linked to their anonymous account (linkWithRedirect,
 * linkWithCredential), so the uid and its scores stay. Signing in to an email
 * account that exists, or a Google account already used before, switches to
 * that account instead; the anonymous scores stay under the old name.
 *
 * The name shown on a player's worlds is their Firebase displayName: the one
 * they type when creating an email account, else the first word of their
 * Google name (never the email). After changing it the ID token is
 * refreshed, so the functions see the new name.
 *
 * The emails Firebase sends (verify an address, reset a password) carry a
 * link back to the game: appLink() below.
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

/** The game's own address with `?flag=1`: the "Continue" link in Firebase's emails. */
export const appLink = (flag) => `${location.origin}${location.pathname}?${flag}=1`;

const firstName = (name) => cleanName(String(name || "").split(" ")[0]);

const toUser = (user) =>
  user
    ? {
        uid: user.uid,
        displayName: cleanName(user.displayName) || "Player",
        email: user.email || null,
        provider: user.isAnonymous
          ? "anonymous"
          : user.providerData.some((p) => p.providerId === "google.com")
            ? "google"
            : "email",
        emailVerified: !!user.emailVerified,
        isAnonymous: !!user.isAnonymous,
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

const signedInUser = (fb) => {
  if (!fb.auth.currentUser) throw new Error("Sign in first.");
  return fb.auth.currentUser;
};

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

    async start(onUser, onError = () => {}) {
      const fb = await loadFirebase();
      // back from Google: a new player gets their first name on their worlds,
      // before anyone hears about the user (null when there was no redirect)
      try {
        const result = await fb.authApi.getRedirectResult(fb.auth);
        const info = result && fb.authApi.getAdditionalUserInfo(result);
        if (result) {
          // a new Google player, or an anonymous one who just linked Google
          // (the link doesn't copy the Google name): first name on their worlds
          if (info && (info.isNewUser || !result.user.displayName)) {
            const google = result.user.providerData.find((p) => p.providerId === "google.com");
            const name = result.user.displayName || (google && google.displayName);
            await rename(fb, result.user, firstName(name));
          }
          // a fresh token, so the functions see the account is no longer anonymous
          await result.user.getIdToken(true);
        }
      } catch (error) {
        // that Google account has signed in before: switch to it, the anonymous scores stay
        const api = fb.authApi;
        const credential =
          error && error.code === "auth/credential-already-in-use"
            ? api.GoogleAuthProvider.credentialFromError(error)
            : null;
        try {
          if (!credential) throw error;
          await api.signInWithCredential(fb.auth, credential);
        } catch (failure) {
          onError(new Error(friendlyError(failure)));
        }
      }
      fb.authApi.onAuthStateChanged(fb.auth, (user) => {
        remember(!!user);
        onUser(toUser(user));
      });
    },

    /** A new anonymous account, for a player who hasn't signed in. */
    async signInAnonymously() {
      const fb = await loadFirebase().catch(rethrow);
      await fb.authApi.signInAnonymously(fb.auth).catch(rethrow);
      return toUser(fb.auth.currentUser);
    },

    /**
     * Leaves the page for Google; start() finishes the sign-in when the game
     * reloads. An anonymous player links Google to their account instead.
     */
    async signInWithGoogle() {
      const fb = await loadFirebase().catch(rethrow);
      const { GoogleAuthProvider, signInWithRedirect, linkWithRedirect } = fb.authApi;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const current = fb.auth.currentUser;
      if (current && current.isAnonymous) await linkWithRedirect(current, provider).catch(rethrow);
      else await signInWithRedirect(fb.auth, provider).catch(rethrow);
      return null;
    },

    async signInWithEmail({ email, password, name, create }) {
      const fb = await loadFirebase().catch(rethrow);
      const api = fb.authApi;
      try {
        if (create) {
          const anonymous = fb.auth.currentUser && fb.auth.currentUser.isAnonymous;
          // an anonymous player keeps their account (and scores): the email is linked to it
          const credential = anonymous
            ? await api.linkWithCredential(
                fb.auth.currentUser,
                api.EmailAuthProvider.credential(email, password),
              )
            : await api.createUserWithEmailAndPassword(fb.auth, email, password);
          await rename(fb, credential.user, cleanName(name));
          // a fresh token, so the functions see the account is no longer anonymous
          if (anonymous) await credential.user.getIdToken(true);
          // a failed send isn't fatal: the verify screen can send it again
          await api
            .sendEmailVerification(credential.user, { url: appLink("verified") })
            .catch(() => {});
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

    async sendVerification() {
      const fb = await loadFirebase().catch(rethrow);
      await fb.authApi
        .sendEmailVerification(signedInUser(fb), { url: appLink("verified") })
        .catch(rethrow);
    },

    /** The signed-in user as the server sees them now (e.g. after verifying). */
    async reload() {
      const fb = await loadFirebase().catch(rethrow);
      const user = signedInUser(fb);
      await user.reload().catch(rethrow);
      // a fresh token, so the functions see email_verified
      await user.getIdToken(true).catch(rethrow);
      return toUser(fb.auth.currentUser);
    },

    async resetPassword(email) {
      const fb = await loadFirebase().catch(rethrow);
      await fb.authApi
        .sendPasswordResetEmail(fb.auth, email, { url: appLink("reset") })
        .catch(rethrow);
    },

    /** The deleteAccount function deletes the account; worlds stay, as "Anonymous". */
    async deleteAccount() {
      const fb = await loadFirebase().catch(rethrow);
      signedInUser(fb);
      const call = fb.functionsApi.httpsCallable(fb.functions, "deleteAccount");
      const result = await call().catch(rethrow);
      remember(false);
      // the account is gone on the server: forget its session here too
      await fb.authApi.signOut(fb.auth).catch(() => {});
      return result.data;
    },

    async signOut() {
      remember(false);
      const fb = await loadFirebase();
      await fb.authApi.signOut(fb.auth);
    },
  };
}
