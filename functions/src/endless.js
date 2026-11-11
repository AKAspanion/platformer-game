/**
 * The endless leaderboard's server logic, free of Firebase so it can be tested
 * on its own (tests/endless-submit.test.js). index.js wires it to Firestore.
 *
 *   handleSubmitEndless({ auth, data: { seed, level, score, seconds } }, { board, limiter, now })
 *     -> { rank, total, best: { level, score, seconds }, improved }
 *
 * `board` (Firestore: endless/{uid}), one best run per player:
 *   get(uid) -> entry | null      set(uid, entry)
 *   rankOf(entry) -> 1-based rank count() -> entries on the board
 *
 * The best run is the highest level, then the higher score, then the shorter
 * time. Everything in the request is untrusted; the name comes from the
 * caller's ID token, never from the request.
 */
import { checkEndlessRun, compareRuns, ENDLESS_LIMIT } from "../shared/modes/endless-rules.js";
import { ApiError } from "./handlers.js";
import { boardName } from "./daily.js";

export { ENDLESS_LIMIT };

export async function handleSubmitEndless({ auth, data }, { board, limiter, now = Date.now }) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to submit a score.");
  }
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const { seed, level, score, seconds } = body;
  if (checkEndlessRun({ seed, level, score, seconds })) {
    throw new ApiError("invalid-argument", "That run can't be ranked.");
  }
  if (await limiter(auth.uid, "endless", ENDLESS_LIMIT)) {
    throw new ApiError("resource-exhausted", "Too many scores, try again in a minute.");
  }

  const run = { level, score, seconds };
  const stored = await board.get(auth.uid);
  const improved = !stored || compareRuns(run, stored) < 0;
  const best = improved
    ? run
    : { level: stored.level, score: stored.score, seconds: stored.seconds };
  if (improved) {
    // uid, name and time come from the server, never from the request
    await board.set(auth.uid, {
      uid: auth.uid,
      name: boardName(auth),
      level,
      score,
      seconds,
      seed,
      updatedAt: now(),
    });
  }
  const [rank, total] = await Promise.all([board.rankOf(best), board.count()]);
  return {
    rank,
    total,
    best: { level: best.level, score: best.score, seconds: best.seconds },
    improved,
  };
}
