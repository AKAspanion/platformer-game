/**
 * The combined leaderboard: one all-time score per player, the sum of their
 * best score in each campaign level, each daily challenge and endless mode.
 * Free of Firebase so it can be tested on its own
 * (tests/totals-functions.test.js); index.js wires it to Firestore.
 *
 *   handleSubmitCampaign({ auth, data: { level, score, seconds, ticket } }, { totals, tickets, limiter, now })
 *     -> { level, best, total }
 *   raisedTotal(stored, { uid, name, part, score }) -> the next totals entry, or null when unchanged
 *
 * `totals` (Firestore: totals/{uid} = { uid, name, score, parts: { [part]: best } }):
 *   raise(uid, { name, part, score }) -> the stored entry after raising that part
 *                                       (read and written in one transaction)
 *
 * A part is "daily-<seed>", "endless" or "level-<area id>". Each holds the
 * best score it has seen and only ever goes up, so a submission sent twice, or
 * a worse run, changes nothing. The total is the sum of the parts. The parts
 * never leave the server: the board reads only name and score
 * (functions/src/boards.js). Everything in a campaign request is untrusted:
 * the run must have started on the server (its ticket, functions/src/runs.js)
 * for that level, and the score counts only up to what the level gives.
 */
import { campaignScore, CAMPAIGN_LIMIT } from "../shared/campaign/score-rules.js";
import { ApiError } from "./handlers.js";
import { boardName } from "./daily.js";
import { withTicket } from "./runs.js";

export { CAMPAIGN_LIMIT };

/** The part a daily challenge, endless mode or a campaign level adds. */
export const dailyPart = (seed) => `daily-${seed}`;
export const ENDLESS_PART = "endless";
export const levelPart = (id) => `level-${id}`;

const PART = /^(daily-\d{8}|endless|level-\d{1,4})$/;
const isPoints = (n) => Number.isInteger(n) && n >= 0;

/** The stored parts, keeping only well-formed ones (a bad one is never added up). */
function partsOf(stored) {
  const parts = {};
  const source = stored && stored.parts;
  if (!source || typeof source !== "object" || Array.isArray(source)) return parts;
  for (const key of Object.keys(source)) {
    if (PART.test(key) && isPoints(source[key])) parts[key] = source[key];
  }
  return parts;
}

/**
 * The totals entry after `score` is offered for `part`: the part keeps the
 * higher of the two, the total is the parts' sum, and the name is the current
 * one. Null when nothing would change, so no write is needed.
 */
export function raisedTotal(stored, { uid, name, part, score }) {
  if (!PART.test(part) || !isPoints(score)) return null;
  const parts = partsOf(stored);
  const raised = !Object.hasOwn(parts, part) || score > parts[part];
  if (raised) parts[part] = score;
  const total = Object.values(parts).reduce((sum, n) => sum + n, 0);
  const same = stored && stored.name === name && stored.score === total && stored.uid === uid;
  if (!raised && same) return null;
  return { uid, name, score: total, parts };
}

const cantRank = () => new ApiError("invalid-argument", "That run can't be ranked.");

export async function handleSubmitCampaign(
  { auth, data },
  { totals, tickets, limiter, now = Date.now },
) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to submit a score.");
  }
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const { level, score, seconds } = body;
  const counted = campaignScore({ level, score, seconds });
  if (counted === null) throw cantRank();
  if (await limiter(auth.uid, "campaign", CAMPAIGN_LIMIT)) {
    throw new ApiError("resource-exhausted", "Too many scores, try again in a minute.");
  }

  const ticketed = { uid: auth.uid, mode: "campaign", seed: level, seconds, now: now() };
  const part = levelPart(level);
  const entry = await withTicket(tickets, body.ticket, ticketed, () =>
    // uid and name come from the server, never from the request
    totals.raise(auth.uid, { name: boardName(auth), part, score: counted }),
  );
  const best = entry && entry.parts && isPoints(entry.parts[part]) ? entry.parts[part] : counted;
  return { level, best, total: entry && isPoints(entry.score) ? entry.score : counted };
}
