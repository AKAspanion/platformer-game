/**
 * The paid ("premium") feature flag. Premium unlocks the daily challenge,
 * endless mode and the prompt-to-world creator.
 *
 * There is no store purchase yet: the flag comes from
 *   - a build-time default (webpack sets PREMIUM_DEFAULT; false for releases),
 *   - or a local unlock: `?premium=1` in the URL, or the developer switch in
 *     Settings (shown on localhost / with ?debug).
 * When Play Billing lands (Digital Goods API in the TWA), `setPremium(true)`
 * is what a verified purchase should call.
 */
const KEY = "premium";

const BUILD_DEFAULT = typeof PREMIUM_DEFAULT !== "undefined" ? PREMIUM_DEFAULT : false;

const storage = () => {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
};

export const setPremium = (value) => {
  const store = storage();
  if (store) store.setItem(KEY, value ? "1" : "0");
};

export const isPremium = () => {
  const store = storage();
  const saved = store && store.getItem(KEY);
  if (saved === "1") return true;
  if (saved === "0") return false;
  return BUILD_DEFAULT;
};

/** Apply `?premium=1` / `?premium=0` from the URL once at start-up. */
export const readPremiumFromUrl = () => {
  try {
    const value = new URLSearchParams(window.location.search).get("premium");
    if (value !== null) setPremium(value !== "0");
  } catch (error) {
    // no URL in tests
  }
};

/** The developer switch is only offered when testing locally. */
export const canToggleLocally = () => {
  try {
    const { hostname, search } = window.location;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname) || /[?&]debug\b/.test(search);
  } catch (error) {
    return false;
  }
};
