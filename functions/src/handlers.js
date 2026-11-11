/**
 * The world creator's server logic, free of Firebase so it can be tested
 * on its own (tests/functions.test.js). index.js wires it to callable
 * functions, Firestore and Claude.
 *
 *   handleDesign({ auth, data: { prompt } }, { design, limiter })  -> { spec }
 *   handlePublish({ auth, data: { world } }, { store, limiter })   -> { world }
 *
 * `auth` is the callable's request.auth ({ uid, token }), null when signed out.
 * Errors are ApiError with a callable error code (index.js turns them into
 * HttpsError, which the game shows to the player).
 */
import { sanitizeWorld, cleanText } from "../shared/spec.js";

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Per user, per hour. */
export const LIMITS = { design: 30, publish: 20 };

export const MAX_PROMPT = 400;

const signedIn = (auth) => {
  if (!auth || !auth.uid) throw new ApiError("unauthenticated", "Sign in to create worlds.");
  return auth;
};

/** The name shown on a user's worlds: the token's display name, never the email. */
export const authorName = (auth) => cleanText(auth && auth.token && auth.token.name, 20, "Someone");

export async function handleDesign({ auth, data }, { design, limiter }) {
  const user = signedIn(auth);
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

export async function handlePublish({ auth, data }, { store, limiter, now = Date.now }) {
  const user = signedIn(auth);
  const world = sanitizeWorld(data && data.world);
  if (!world) throw new ApiError("invalid-argument", "That world can't be shared.");
  if (await limiter(user.uid, "publish", LIMITS.publish)) {
    throw new ApiError("resource-exhausted", "You shared a lot of worlds lately, try again later.");
  }
  // the author and time come from the server, never from the request
  world.author = { uid: user.uid, name: authorName(user) };
  world.createdAt = now();
  await store.create(world); // ApiError("already-exists") when the id is taken
  return { world };
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
