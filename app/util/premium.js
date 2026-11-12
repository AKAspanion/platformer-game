/**
 * The paid ("premium") feature flag. Premium covers the features that use AI:
 * today, the prompt-to-world creator. The daily challenge and endless mode are free.
 *
 * There is no store purchase yet. A player has Premium when
 *   - their account has it: Firestore entitlements/{uid} = { premium: true }, set
 *     by the developer in the Firebase console (README, "Premium"). The designWorld
 *     function checks the same doc, so this is the one that counts online;
 *   - or, for testing, a local unlock: `?premium=1` in the URL, or the developer
 *     switch in Settings (shown on localhost, or with ?debug on a PR preview
 *     channel; never on the live game);
 *   - or a build-time default (webpack sets PREMIUM_DEFAULT; false for releases).
 * When Play Billing lands (Digital Goods API in the TWA), a verified purchase
 * should write the player's entitlements doc from a function.
 */
const KEY = "premium";
// the uid whose entitlement said Premium last time, so a start before Firestore
// answers (or offline) keeps it; cleared when the account has no Premium or signs out
const ACCOUNT_KEY = "premiumAccount";

const BUILD_DEFAULT = typeof PREMIUM_DEFAULT !== "undefined" ? PREMIUM_DEFAULT : false;

const storage = () => {
  try {
    return globalThis.localStorage;
  } catch (error) {
    return null;
  }
};

export const setPremium = (value) => {
  const store = storage();
  if (store) store.setItem(KEY, value ? "1" : "0");
};

let accountPremium = (() => {
  const store = storage();
  return !!(store && store.getItem(ACCOUNT_KEY));
})();

/** Premium from the signed-in account's entitlement (watchAccountPremium sets it). */
export const hasAccountPremium = () => accountPremium;

const setAccountPremium = (uid, value) => {
  accountPremium = !!(uid && value);
  const store = storage();
  if (!store) return;
  if (accountPremium) store.setItem(ACCOUNT_KEY, uid);
  else store.removeItem(ACCOUNT_KEY);
};

/**
 * Follows the signed-in account's Premium: on every sign-in it asks
 * `entitlements.premium(uid)` and calls onChange() when Premium turns on or off.
 * Signing out drops it; an anonymous player has none (designing needs a real account).
 * A failed lookup (offline) keeps what was known for that account.
 *
 *   const stop = watchAccountPremium(auth, firestoreEntitlements, () => refreshHome());
 */
export function watchAccountPremium(auth, entitlements, onChange = () => {}) {
  let asking = 0;
  const update = (uid, value) => {
    const before = isPremium();
    setAccountPremium(uid, value);
    if (isPremium() !== before) onChange();
  };
  return auth.onAuthStateChanged(async (user) => {
    const ask = ++asking;
    if (!user || user.isAnonymous) {
      update(null, false);
      return;
    }
    const store = storage();
    // a different account than the remembered one starts without Premium until it answers
    if (store && store.getItem(ACCOUNT_KEY) !== user.uid) update(null, false);
    try {
      const premium = await entitlements.premium(user.uid);
      if (ask === asking) update(user.uid, premium);
    } catch (error) {
      // offline or Firestore down: keep what was known for this account
    }
  });
}

export const isPremium = () => {
  if (accountPremium) return true;
  const store = storage();
  const saved = store && store.getItem(KEY);
  if (saved === "1") return true;
  if (saved === "0") return false;
  return BUILD_DEFAULT;
};

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;
// Firebase Hosting preview channels: <site>--<channel>-<hash>.web.app
const PREVIEW_HOST = /--[a-z0-9-]+\.web\.app$/;

/** Hosts where testing switches are allowed: local dev and PR preview channels, never the live game. */
export const isTestHost = (hostname) => LOCAL_HOST.test(hostname) || PREVIEW_HOST.test(hostname);

/** Apply `?premium=1` / `?premium=0` from the URL once at start-up (test hosts only). */
export const readPremiumFromUrl = () => {
  try {
    if (!isTestHost(window.location.hostname)) return;
    const value = new URLSearchParams(window.location.search).get("premium");
    if (value !== null) setPremium(value !== "0");
  } catch (error) {
    // no URL in tests
  }
};

/** The developer switch is only offered when testing locally (or ?debug on a preview channel). */
export const canToggleLocally = () => {
  try {
    const { hostname, search } = window.location;
    return LOCAL_HOST.test(hostname) || (PREVIEW_HOST.test(hostname) && /[?&]debug\b/.test(search));
  } catch (error) {
    return false;
  }
};
