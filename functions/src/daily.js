/**
 * The daily leaderboard's server logic, free of Firebase so it can be tested
 * on its own (tests/daily-submit.test.js). index.js wires it to Firestore.
 *
 *   handleSubmitDaily({ auth, data: { seed, score, seconds, ticket } }, { scores, tickets, limiter, now })
 *     -> { rank, total, best: { score, seconds }, improved }
 *
 * `scores` (Firestore: daily/{seed}/scores/{uid}):
 *   get(seed, uid) -> entry | null        set(seed, uid, entry)
 *   rankOf(seed, entry) -> 1-based rank   count(seed) -> entries that day
 *
 * Everything in the request is untrusted: the seed must be an open day, the
 * score a possible one, the time a plausible one, the run must have started on
 * the server (its ticket, functions/src/runs.js), and the name is never read
 * from the request (it comes from the caller's ID token).
 */
import {
  seedIsOpen,
  dailyScoreCeiling,
  generatedName,
  MIN_SECONDS,
  MAX_SECONDS,
} from "../shared/daily/rules.js";
import { ApiError, authorName } from "./handlers.js";
import { withTicket } from "./runs.js";

/** Submissions per player per hour. */
export const DAILY_LIMIT = 30;

/** True when run `a` ranks above run `b`: higher score first, then the shorter time. */
export const outranks = (a, b) =>
  a.score > b.score || (a.score === b.score && a.seconds < b.seconds);

/** The 1-based rank `entry` has among `entries` (one best run per player). */
export const rankIn = (entries, entry) =>
  1 + entries.filter((other) => outranks(other, entry)).length;

const isAnonymous = (auth) => {
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  return provider === "anonymous";
};

/** The name shown on the board: the generated one for an anonymous player, else their display name. */
export const boardName = (auth) => (isAnonymous(auth) ? generatedName(auth.uid) : authorName(auth));

const cantRank = () => new ApiError("invalid-argument", "That run can't be ranked.");

export async function handleSubmitDaily(
  { auth, data },
  { scores, tickets, limiter, now = Date.now },
) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to submit a score.");
  }
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const { seed, score, seconds } = body;
  if (!seedIsOpen(seed, now())) {
    throw new ApiError("failed-precondition", "That daily challenge has closed.");
  }
  if (!Number.isInteger(score) || score < 0 || score > dailyScoreCeiling(seed)) throw cantRank();
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) throw cantRank();
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) throw cantRank();
  if (await limiter(auth.uid, "daily", DAILY_LIMIT)) {
    throw new ApiError("resource-exhausted", "Too many scores, try again in a minute.");
  }

  const run = { score, seconds };
  const ticketed = { uid: auth.uid, mode: "daily", seed, seconds, now: now() };
  const { improved, best } = await withTicket(tickets, body.ticket, ticketed, async () => {
    const stored = await scores.get(seed, auth.uid);
    const better = !stored || outranks(run, stored);
    if (better) {
      // uid and name come from the server, never from the request; no time is
      // stored, so a board entry can't carry one (spec 4.4)
      await scores.set(seed, auth.uid, {
        uid: auth.uid,
        name: boardName(auth),
        score,
        seconds,
      });
    }
    return {
      improved: better,
      best: better ? run : { score: stored.score, seconds: stored.seconds },
    };
  });
  const [rank, total] = await Promise.all([scores.rankOf(seed, best), scores.count(seed)]);
  return { rank, total, best: { score: best.score, seconds: best.seconds }, improved };
}
