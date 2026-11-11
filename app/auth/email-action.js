/**
 * The links in the game's account emails (verify an address, reset a
 * password, undo an email change) open the game's own page,
 * /auth/action (app/pages/auth-action.js), instead of Firebase's.
 *
 *   readAction(search, origin) -> { mode, oobCode, next } | { error }
 *   actionError(error)         -> what to tell the player when a link fails
 *
 * Firebase adds mode, oobCode, apiKey, continueUrl and lang to the action URL
 * set in the console (Authentication > Templates > Customize action URL).
 * continueUrl is the game address the email was sent from (appLink in
 * app/firebase/auth.js); anything on another origin is ignored, so the page
 * can't be used to send players elsewhere.
 */
import { friendlyError } from "../firebase/index";

export const MODES = ["verifyEmail", "resetPassword", "recoverEmail", "verifyAndChangeEmail"];

/** Where each mode sends the player afterwards when the link names no game address. */
const DEFAULT_NEXT = {
  verifyEmail: "/?verified=1",
  resetPassword: "/?reset=1",
  recoverEmail: "/",
  verifyAndChangeEmail: "/",
};

export const BROKEN_LINK =
  "This link isn't complete. Open it straight from the email, or ask the game for a new one.";

/** A same-origin path from continueUrl, else null. */
export function sameOriginPath(url, origin) {
  if (!url) return null;
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch (error) {
    return null;
  }
}

export function readAction(search, origin) {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  if (!MODES.includes(mode) || !oobCode) return { error: BROKEN_LINK };
  const next = sameOriginPath(params.get("continueUrl"), origin) || DEFAULT_NEXT[mode];
  return { mode, oobCode, next };
}

const ACTION_ERRORS = {
  "expired-action-code": "This link has expired. Ask the game for a new one.",
  "invalid-action-code":
    "This link was already used or has been replaced by a newer one. Ask the game for a new one if you still need it.",
  "user-not-found": "The account for this link no longer exists.",
};

export function actionError(error) {
  const code = String((error && error.code) || "").replace(/^auth\//, "");
  return ACTION_ERRORS[code] || friendlyError(error);
}
