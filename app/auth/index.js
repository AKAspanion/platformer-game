import { cleanName, validEmail } from "./names";

/**
 * Sign-in, used only by the world creator (story, levels, daily and endless
 * never ask for it).
 *
 * One facade, pluggable backends: Firebase Auth in the game
 * (app/firebase/auth.js), a device-only mock in tests (./mock.js).
 *
 *   auth.use(backend)                       pick the backend (once, at start)
 *   auth.start()                            restore the session (loads Firebase)
 *   auth.ready(ms)                          -> resolves once the session is known (or after ms)
 *   auth.currentUser                        -> { uid, displayName, email, provider } | null
 *   auth.onAuthStateChanged(cb)             -> unsubscribe()
 *   auth.signInWithGoogle({ name })         -> user (null while a redirect takes over)
 *   auth.signInWithEmail({ email, password, name, create })
 *   auth.resetPassword(email)
 *   auth.signOut()
 *
 * The functions get the player's verified ID token from the Firebase SDK
 * (callable functions), so there is no token to pass around here.
 */

export { cleanName, validEmail };

export function createAuth(initial = null) {
  let backend = initial;
  let current = null;
  let started = null;
  let known = false;
  let markKnown;
  const knownPromise = new Promise((resolve) => (markKnown = resolve));
  const listeners = new Set();

  // the backend reports a change and the sign-in call returns it: tell listeners once
  const set = (user) => {
    const same = known && JSON.stringify(user || null) === JSON.stringify(current);
    current = user || null;
    known = true;
    markKnown();
    if (!same) listeners.forEach((cb) => cb(current));
    return current;
  };

  const need = () => {
    if (!backend) throw new Error("Sign-in isn't available.");
    return backend;
  };

  return {
    get mode() {
      return backend ? backend.mode : "none";
    },

    get currentUser() {
      return current;
    },

    /** True once the backend said who is signed in (or that nobody is). */
    get known() {
      return known;
    },

    use(next) {
      backend = next;
      started = null;
    },

    start() {
      if (!started) {
        started = Promise.resolve()
          .then(() => need().start(set))
          .catch(() => {
            // offline or blocked: signed out for now, the next start() retries
            started = null;
            known = true;
            markKnown();
          });
      }
      return started;
    },

    /** Start if this device signed in before, so returning players stay signed in. */
    resume() {
      if (backend && backend.signedInBefore && backend.signedInBefore()) this.start();
    },

    ready(timeoutMs = 6000) {
      this.start();
      return Promise.race([knownPromise, new Promise((r) => setTimeout(r, timeoutMs))]);
    },

    onAuthStateChanged(cb) {
      listeners.add(cb);
      if (known) cb(current);
      return () => listeners.delete(cb);
    },

    async signInWithGoogle({ name } = {}) {
      if (name && cleanName(name).length < 2)
        throw new Error("Pick a name with at least 2 letters.");
      const user = await need().signInWithGoogle({ name });
      return user ? set(user) : null;
    },

    async signInWithEmail({ email, password, name, create = false } = {}) {
      const address = String(email || "").trim();
      if (!validEmail(address)) throw new Error("That email doesn't look right.");
      if (!password) throw new Error("Enter your password.");
      if (create) {
        if (cleanName(name).length < 2) throw new Error("Pick a name with at least 2 letters.");
        if (String(password).length < 6)
          throw new Error("Use a password with at least 6 characters.");
      }
      return set(await need().signInWithEmail({ email: address, password, name, create }));
    },

    async resetPassword(email) {
      const address = String(email || "").trim();
      if (!validEmail(address)) throw new Error("Enter your email first.");
      await need().resetPassword(address);
    },

    async signOut() {
      await need().signOut();
      set(null);
    },
  };
}

/** The game's sign-in (app/index.js picks the Firebase backend). */
export const auth = createAuth();
