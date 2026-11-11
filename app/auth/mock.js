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
      emailVerified: account.provider === "google" || !!account.verified,
      isAnonymous: account.provider === "anonymous",
    };
    onUser(user);
    return user;
  };
  const byUid = (state, uid) => Object.values(state.accounts).find((a) => a.uid === uid);
  /** The anonymous account signed in now, if any: linking keeps its uid. */
  const anonymousNow = (state) => {
    const account = state.current && byUid(state, state.current);
    return account && account.provider === "anonymous" ? account : null;
  };
  /** Gives the anonymous account `key` and its new details, keeping the uid. */
  const link = (state, anonymous, key, details) => {
    Object.keys(state.accounts).forEach((k) => {
      if (state.accounts[k] === anonymous) delete state.accounts[k];
    });
    state.accounts[key] = { ...anonymous, ...details };
    return state.accounts[key];
  };

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

    async signInAnonymously() {
      const state = read();
      const uid = newUid();
      state.accounts[`anon:${uid}`] = { uid, provider: "anonymous" };
      return signIn(state, state.accounts[`anon:${uid}`]);
    },

    async signInWithGoogle({ name } = {}) {
      const state = read();
      const key = `google:${cleanName(name) || "Player"}`;
      const anonymous = anonymousNow(state);
      if (!state.accounts[key]) {
        const details = { name: cleanName(name) || "Player", provider: "google" };
        // an anonymous player keeps their account; a Google account is new otherwise
        if (anonymous) link(state, anonymous, key, details);
        else state.accounts[key] = { uid: newUid(), ...details };
      }
      return signIn(state, state.accounts[key]);
    },

    async signInWithEmail({ email, password, name, create }) {
      const state = read();
      const key = `email:${email.toLowerCase()}`;
      const existing = state.accounts[key];
      if (create) {
        if (existing) throw new Error("That email already has an account. Sign in instead.");
        const details = { name: cleanName(name), email, password, provider: "email" };
        const anonymous = anonymousNow(state);
        // an anonymous player's account is linked to the email: same uid
        if (anonymous) link(state, anonymous, key, details);
        else state.accounts[key] = { uid: newUid(), ...details };
      } else if (!existing || existing.password !== password) {
        throw new Error("Wrong email or password.");
      } else if (cleanName(name)) {
        existing.name = cleanName(name);
      }
      return signIn(state, state.accounts[key]);
    },

    async resetPassword() {},

    // tests verify an address with verifyEmail(email) below
    async sendVerification() {},

    async reload() {
      const state = read();
      return signIn(state, byUid(state, state.current));
    },

    async deleteAccount() {
      const state = read();
      Object.keys(state.accounts).forEach((key) => {
        if (state.accounts[key].uid === state.current) delete state.accounts[key];
      });
      state.current = null;
      write(state);
      onUser(null);
      return { worlds: 0 };
    },

    async signOut() {
      const state = read();
      state.current = null;
      write(state);
      onUser(null);
    },
  };
}

/** Tests: the player opened the link in their verify email. */
export function verifyEmail(email) {
  const state = read();
  const account = state.accounts[`email:${email.toLowerCase()}`];
  if (account) account.verified = true;
  write(state);
}
