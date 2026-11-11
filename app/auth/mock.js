import { cleanName } from "./names";

/**
 * A device-only auth backend for tests: accounts live in localStorage, no
 * network. Same shape as app/firebase/auth.js.
 */

const KEY = "mock_auth";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { accounts: {}, current: null };
  } catch (error) {
    return { accounts: {}, current: null };
  }
};
const write = (state) => localStorage.setItem(KEY, JSON.stringify(state));

let counter = 0;
const newUid = () => `mock_${Date.now().toString(36)}${(counter++).toString(36)}`;

export function mockAuthBackend() {
  let onUser = () => {};
  const signIn = (state, account) => {
    state.current = account.uid;
    write(state);
    const user = {
      uid: account.uid,
      displayName: account.name || "Player",
      email: account.email || null,
      provider: account.provider,
    };
    onUser(user);
    return user;
  };
  const byUid = (state, uid) => Object.values(state.accounts).find((a) => a.uid === uid);

  return {
    mode: "mock",
    signedInBefore: () => !!read().current,

    async start(callback) {
      onUser = callback;
      const state = read();
      const account = state.current && byUid(state, state.current);
      if (account) signIn(state, account);
      else onUser(null);
    },

    async signInWithGoogle({ name } = {}) {
      const state = read();
      const key = `google:${cleanName(name) || "Player"}`;
      state.accounts[key] = state.accounts[key] || {
        uid: newUid(),
        name: cleanName(name) || "Player",
        provider: "google",
      };
      return signIn(state, state.accounts[key]);
    },

    async signInWithEmail({ email, password, name, create }) {
      const state = read();
      const key = `email:${email.toLowerCase()}`;
      const existing = state.accounts[key];
      if (create) {
        if (existing) throw new Error("That email already has an account. Sign in instead.");
        state.accounts[key] = {
          uid: newUid(),
          name: cleanName(name),
          email,
          password,
          provider: "email",
        };
      } else if (!existing || existing.password !== password) {
        throw new Error("Wrong email or password.");
      } else if (cleanName(name)) {
        existing.name = cleanName(name);
      }
      return signIn(state, state.accounts[key]);
    },

    async resetPassword() {},

    async signOut() {
      const state = read();
      state.current = null;
      write(state);
      onUser(null);
    },
  };
}
