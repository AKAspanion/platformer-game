/**
 * The paid ("premium") feature flag. Premium covers the features that use AI:
 * today, the prompt-to-world creator. The daily challenge and endless mode are free.
 *
 * There is no store purchase yet: the flag comes from
 *   - a build-time default (webpack sets PREMIUM_DEFAULT; false for releases),
 *   - or a local unlock: `?premium=1` in the URL, or the developer switch in
 *     Settings (shown on localhost, or with ?debug on a PR preview channel;
 *     never on the live game).
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
