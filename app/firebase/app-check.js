/**
 * App Check: proves calls to the functions come from the real game (reCAPTCHA
 * Enterprise in the browser), so scripts can't farm throwaway accounts against
 * them. Off until FIREBASE_APPCHECK_SITE_KEY is set in .env.
 *
 *   appCheckPlan({ siteKey, debugToken, hostname, emulators }) -> { use, siteKey, debugToken }
 *   startAppCheck(app, plan) -> true when App Check started
 *
 * Locally the reCAPTCHA key usually doesn't list localhost: a debug token
 * (Firebase console > App Check > Apps > Manage debug tokens) stands in for it.
 * Release builds never carry one (webpack.config.js drops it), and it is only
 * used on local hosts anyway. The emulators don't check App Check, so it stays
 * off against them.
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function appCheckPlan({ siteKey, debugToken, hostname, emulators }) {
  if (!siteKey || emulators) return { use: false, siteKey: null, debugToken: null };
  const local = LOCAL_HOST.test(String(hostname || ""));
  return { use: true, siteKey, debugToken: local && debugToken ? debugToken : null };
}

/** Starts App Check on `app` when the plan says so; never throws (the game works without it). */
export async function startAppCheck(app, plan) {
  if (!plan.use) return false;
  try {
    // the SDK reads this global before it starts
    if (plan.debugToken) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = plan.debugToken;
    const api = await import(/* webpackChunkName: "firebase" */ "firebase/app-check");
    api.initializeAppCheck(app, {
      provider: new api.ReCaptchaEnterpriseProvider(plan.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return true;
  } catch (error) {
    // functions in monitor mode still answer; in enforce mode they will say so
    return false;
  }
}
