/**
 * Sign-in, used only by the world creator (story, levels, daily and endless
 * never ask for it).
 *
 * MOCK for now: no network, no password. The user picks a display name (and
 * optionally an email) and is "signed in" on this device. The API mirrors
 * Firebase Auth so the swap is local to this file:
 *
 *   auth.currentUser                  -> { uid, displayName, email, provider } | null
 *   auth.onAuthStateChanged(cb)       -> unsubscribe()
 *   auth.signInWithGoogle({ name })   -> user   (Firebase: signInWithPopup + GoogleAuthProvider)
 *   auth.signInWithEmail({ name, email }) -> user (Firebase: email link / password)
 *   auth.signOut()
 *   auth.getIdToken()                 -> token sent to the world server
 *
 * Mock tokens look like "mock.<base64url json>"; server/world-api.mjs accepts
 * them only while AUTH_MODE=mock. With Firebase, getIdToken() returns the real
 * ID token and the server verifies it with firebase-admin.
 */

const KEY = "auth_user";
const listeners = new Set();

const storage = () => {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
};

const read = () => {
  try {
    const raw = storage() && storage().getItem(KEY);
    const user = raw ? JSON.parse(raw) : null;
    return user && user.uid ? user : null;
  } catch (error) {
    return null;
  }
};

const write = (user) => {
  const store = storage();
  if (!store) return;
  if (user) store.setItem(KEY, JSON.stringify(user));
  else store.removeItem(KEY);
};

const randomId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10).padEnd(8, "0");

/** Display names: letters, digits, spaces and a little punctuation, 2-20 chars. */
export const cleanName = (name) =>
  String(name || "")
    .replace(/[^A-Za-z0-9À-ɏ ._'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);

export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

const base64url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

let current = read();

const emit = () => listeners.forEach((cb) => cb(current));

const signIn = (provider, { name, email } = {}) => {
  const displayName = cleanName(name);
  if (displayName.length < 2) throw new Error("Pick a name with at least 2 letters.");
  if (provider === "email" && !validEmail(email)) throw new Error("That email doesn't look right.");
  // the same name + email on this device keeps the same account
  const previous = read();
  const same =
    previous &&
    previous.provider === provider &&
    previous.displayName === displayName &&
    (provider !== "email" || previous.email === String(email).trim().toLowerCase());
  current = {
    uid: same ? previous.uid : `mock_${randomId()}`,
    displayName,
    email: provider === "email" ? String(email).trim().toLowerCase() : null,
    provider,
    createdAt: same ? previous.createdAt : Date.now(),
  };
  write(current);
  emit();
  return current;
};

export const auth = {
  mode: "mock",

  get currentUser() {
    return current;
  },

  onAuthStateChanged(cb) {
    listeners.add(cb);
    cb(current);
    return () => listeners.delete(cb);
  },

  async signInWithGoogle(options) {
    return signIn("google", options);
  },

  async signInWithEmail(options) {
    return signIn("email", options);
  },

  async signOut() {
    current = null;
    write(null);
    emit();
  },

  /** Bearer token for the world server (mock: unsigned, the server must be in mock mode). */
  async getIdToken() {
    if (!current) return null;
    return `mock.${base64url(
      JSON.stringify({ uid: current.uid, name: current.displayName, iat: Date.now() }),
    )}`;
  },

  /** Tests: forget the cached user and re-read storage. */
  _reload() {
    current = read();
    emit();
  },
};
