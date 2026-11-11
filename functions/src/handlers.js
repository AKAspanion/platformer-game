/**
 * The world creator's server logic, free of Firebase so it can be tested
 * on its own (tests/functions.test.js). index.js wires it to callable
 * functions, Firestore and Claude.
 *
 *   handleDesign({ auth, data: { prompt } }, { design, limiter })  -> { spec }
 *   handlePublish({ auth, data: { world, thumb? } }, { store, limiter }) -> { world }
 *   handleSearch({ auth, data: { query } }, { allWorlds })         -> { worlds }
 *   handleDeleteAccount({ auth }, { accounts })                    -> { worlds }
 *
 * `auth` is the callable's request.auth ({ uid, token }), null when signed out.
 * Errors are ApiError with a callable error code (index.js turns them into
 * HttpsError, which the game shows to the player).
 */
import { checkThumb } from "./community.js";
import { sanitizeWorld, cleanText, matchWorlds, searchTerms, ANONYMOUS } from "../shared/spec.js";

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Per user, per hour. */
export const LIMITS = { design: 30, publish: 20 };

export const MAX_PROMPT = 400;

export const signedIn = (auth) => {
  if (!auth || !auth.uid) throw new ApiError("unauthenticated", "Sign in to create worlds.");
  return auth;
};

/**
 * Email + password accounts confirm their address before creating worlds
 * (Google accounts are verified by Google). The game asks for it first; this
 * is the check that counts.
 */
const verified = (auth) => {
  const token = auth.token || {};
  const provider = token.firebase && token.firebase.sign_in_provider;
  if (provider === "password" && token.email_verified !== true) {
    throw new ApiError("permission-denied", "Verify your email to create worlds.");
  }
  return auth;
};

/** The name shown on a user's worlds: the token's display name, never the email. */
export const authorName = (auth) => cleanText(auth && auth.token && auth.token.name, 20, "Someone");

export async function handleDesign({ auth, data }, { design, limiter }) {
  const user = verified(signedIn(auth));
  const prompt = String((data && data.prompt) || "")
    .trim()
    .slice(0, MAX_PROMPT);
  if (prompt.length < 3) throw new ApiError("invalid-argument", "Describe your world first.");
  if (await limiter(user.uid, "design", LIMITS.design)) {
    throw new ApiError(
      "resource-exhausted",
      "You designed a lot of worlds lately, try again later.",
    );
  }
  const result = await design(prompt);
  if (result.refused) {
    throw new ApiError("invalid-argument", "Try describing a different world.");
  }
  return { spec: result.spec };
}

export async function handlePublish(
  { auth, data },
  { store, limiter, now = Date.now, log = () => {} },
) {
  const user = verified(signedIn(auth));
  const world = sanitizeWorld(data && data.world);
  if (!world) throw new ApiError("invalid-argument", "That world can't be shared.");
  if (await limiter(user.uid, "publish", LIMITS.publish)) {
    throw new ApiError("resource-exhausted", "You shared a lot of worlds lately, try again later.");
  }
  // the author and time come from the server, never from the request
  world.author = { uid: user.uid, name: authorName(user) };
  world.createdAt = now();
  // a thumbnail that isn't a small PNG is dropped: the world shares without one
  const thumb = data.thumb === undefined ? null : checkThumb(data.thumb);
  if (data.thumb !== undefined && !thumb) log("world thumbnail dropped");
  await store.create(world, thumb); // ApiError("already-exists") when the id is taken
  return { world };
}

export const MAX_RESULTS = 30;

/** Every shared world matching `query` (allWorlds() -> raw[], cached by index.js). */
export async function handleSearch({ auth, data }, { allWorlds }) {
  signedIn(auth);
  const query = String((data && data.query) || "").slice(0, 60);
  if (searchTerms(query).join("").length < 2) {
    throw new ApiError("invalid-argument", "Type at least 2 letters to search.");
  }
  const worlds = (await allWorlds()).map(sanitizeWorld).filter(Boolean);
  return { worlds: matchWorlds(worlds, query, MAX_RESULTS) };
}

/**
 * Deletes the caller's account. Their worlds stay shared, credited to
 * "Anonymous" with no account behind them; their daily leaderboard scores are
 * deleted, and so are their endless entry, cloud save, leaderboard profile and reminders; then their rate limits and the account
 * itself go. `accounts`: anonymizeWorlds(uid, author) -> count, deleteDailyScores(uid), deleteEndless(uid),
 * deleteSave(uid), deleteProfile(uid), deleteReminders(uid), deleteData(uid), deleteUser(uid).
 */
export async function handleDeleteAccount({ auth }, { accounts }) {
  const user = signedIn(auth);
  const worlds = await accounts.anonymizeWorlds(user.uid, { uid: "", name: ANONYMOUS });
  await accounts.deleteDailyScores(user.uid);
  await accounts.deleteEndless(user.uid);
  await accounts.deleteSave(user.uid);
  await accounts.deleteProfile(user.uid);
  await accounts.deleteReminders(user.uid);
  await accounts.deleteData(user.uid);
  await accounts.deleteUser(user.uid);
  return { worlds };
}

/**
 * A sliding one-hour window of timestamps per user and kind, kept in a
 * document. `tx` is a minimal transaction: get(uid) -> {kind: [ms]} | null,
 * set(uid, patch).
 */
export async function overLimit(tx, uid, kind, max, now = Date.now()) {
  const doc = (await tx.get(uid)) || {};
  const recent = (Array.isArray(doc[kind]) ? doc[kind] : []).filter(
    (t) => typeof t === "number" && now - t < 3600000,
  );
  if (recent.length >= max) return true;
  recent.push(now);
  tx.set(uid, { [kind]: recent });
  return false;
}
