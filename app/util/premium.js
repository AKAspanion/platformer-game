/**
 * Premium: the features that use AI (today, the prompt-to-world creator). The daily
 * challenge and endless mode are free.
 *
 * A player has Premium only when Firestore says so: their signed-in account's
 * entitlements/{uid} document has the boolean field `premium` set to `true`. The
 * developer sets it in the Firebase console (README, "Giving a player Premium"), and the
 * designWorld function checks the same document. Nothing on the device can turn it on:
 * no URL, switch, build flag or saved value, and nothing is remembered between visits,
 * so a player signed out, offline or anonymous has no Premium.
 * When Play Billing lands, a verified purchase should write that document from a function.
 */

let premium = false;

// URL, switch and build-flag Premium of earlier versions left these behind; they mean nothing now
try {
  globalThis.localStorage.removeItem("premium");
  globalThis.localStorage.removeItem("premiumAccount");
} catch (error) {
  // no storage: nothing to clear
}

export const isPremium = () => premium;

/**
 * Follows the signed-in account's Premium: on every sign-in it asks
 * `entitlements.premium(uid)` (true only for the boolean `true` in Firestore) and calls
 * onChange() when Premium turns on or off. Signing out, an anonymous player (designing
 * needs a real account) or a failed lookup leaves the player without Premium.
 *
 *   const stop = watchAccountPremium(auth, firestoreEntitlements, () => refreshHome());
 */
export function watchAccountPremium(auth, entitlements, onChange = () => {}) {
  let asking = 0;
  const set = (value) => {
    if (premium === value) return;
    premium = value;
    onChange();
  };
  return auth.onAuthStateChanged(async (user) => {
    const ask = ++asking;
    // until Firestore answers for this account, it has no Premium
    set(false);
    if (!user || user.isAnonymous) return;
    let answer = false;
    try {
      answer = (await entitlements.premium(user.uid)) === true;
    } catch (error) {
      // offline or Firestore down: no Premium until it answers (designing needs it online anyway)
    }
    if (ask === asking) set(answer);
  });
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;
// Firebase Hosting preview channels: <site>--<channel>-<hash>.web.app
const PREVIEW_HOST = /--[a-z0-9-]+\.web\.app$/;

/** Hosts where testing switches are allowed: local dev and PR preview channels, never the live game. */
export const isTestHost = (hostname) => LOCAL_HOST.test(hostname) || PREVIEW_HOST.test(hostname);

/** Developer switches (such as unlocking every level) are only offered when testing locally (or ?debug on a preview channel). */
export const canToggleLocally = () => {
  try {
    const { hostname, search } = window.location;
    return LOCAL_HOST.test(hostname) || (PREVIEW_HOST.test(hostname) && /[?&]debug\b/.test(search));
  } catch (error) {
    return false;
  }
};
