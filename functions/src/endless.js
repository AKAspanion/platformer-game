/**
 * The endless leaderboard's server logic, free of Firebase so it can be tested
 * on its own (tests/endless-submit.test.js). index.js wires it to Firestore.
 *
 *   handleSubmitEndless({ auth, data: { seed, level, score, seconds, ticket } }, { board, totals, tickets, limiter, now })
 *     -> { rank, total, best: { level, score, seconds }, improved }
 *
 * `board` (Firestore: endless/{uid}), one best run per player:
 *   get(uid) -> entry | null      set(uid, entry)
 *   rankOf(entry) -> 1-based rank count() -> entries on the board
 * `totals` (optional, totals/{uid}): the highest endless score counts towards
 * the combined board (functions/src/totals.js), raise(uid, { name, part, score }).
 *
 * The best run is the highest level, then the higher score, then the shorter
 * time. Everything in the request is untrusted: the run must have started on
 * the server, which picked its seed (its ticket, functions/src/runs.js); the
 * name comes from the caller's ID token, never from the request.
 */
import { checkEndlessRun, compareRuns, ENDLESS_LIMIT } from "../shared/modes/endless-rules.js";
import { ApiError } from "./handlers.js";
import { boardName } from "./daily.js";
import { withTicket } from "./runs.js";

export { ENDLESS_LIMIT };

export async function handleSubmitEndless(
  { auth, data },
  { board, totals, tickets, limiter, now = Date.now },
) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to submit a score.");
  }
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const { seed, level, score, seconds } = body;
  // limited first: checking a run's ceiling costs real CPU for deep levels
  if (await limiter(auth.uid, "endless", ENDLESS_LIMIT)) {
    throw new ApiError("resource-exhausted", "Too many scores, try again in a minute.");
  }
  if (checkEndlessRun({ seed, level, score, seconds })) {
    throw new ApiError("invalid-argument", "That run can't be ranked.");
  }

  const run = { level, score, seconds };
  const ticketed = { uid: auth.uid, mode: "endless", seed, seconds, now: now() };
  const { improved, best } = await withTicket(tickets, body.ticket, ticketed, async () => {
    const stored = await board.get(auth.uid);
    const better = !stored || compareRuns(run, stored) < 0;
    if (better) {
      // uid and name come from the server, never from the request; no time is
      // stored, so a board entry can't carry one (spec 4.4)
      await board.set(auth.uid, {
        uid: auth.uid,
        name: boardName(auth),
        level,
        score,
        seconds,
        seed,
      });
    }
    // the highest endless score, whichever run ranks best (a part only goes up)
    if (totals) {
      await totals.raise(auth.uid, { name: boardName(auth), part: "endless", score });
    }
    return {
      improved: better,
      best: better ? run : { level: stored.level, score: stored.score, seconds: stored.seconds },
    };
  });
  const [rank, total] = await Promise.all([board.rankOf(best), board.count()]);
  return {
    rank,
    total,
    best: { level: best.level, score: best.score, seconds: best.seconds },
    improved,
  };
}
