/**
 * Run tickets: a ranked daily or endless run starts on the server. Free of
 * Firebase, like handlers.js (tests/run-tickets.test.js); index.js wires it to
 * Firestore (runs/{ticket}, closed to clients).
 *
 *   handleStartRun({ auth, data: { mode, seed? } }, { tickets, limiter, now, newSeed })
 *     -> { ticket, seed, startedAt }
 *   claimTicket(tickets, id, { uid, mode, seed, seconds, now })   throws when it can't rank
 *
 * A ticket fixes the run's account, mode and seed (the server picks endless
 * seeds, so nobody can shop for an easy one) and its start time. Submitting a
 * score uses the ticket up, and the run's own clock can't claim more time than
 * really passed since the ticket was issued, so a script can't post a score
 * the moment it starts a run.
 *
 * `tickets`: create(data) -> id; claim(id, accept(ticket) -> boolean) -> boolean,
 * marking the ticket used in the same transaction when accept says yes;
 * release(id) gives a claimed ticket back (the score couldn't be stored).
 */
import { randomInt } from "node:crypto";
import { seedIsOpen } from "../shared/daily/rules.js";
import { ApiError } from "./handlers.js";

const DAY_MS = 86400000;

export const MODES = ["daily", "endless"];
/** Tickets per account per hour: a run, a retry, another... */
export const RUN_LIMIT = 60;
/**
 * How long a ticket can still rank its run: long enough for the offline queue
 * to send it later (a daily seed closes within a day or two anyway).
 */
export const TICKET_TTL_MS = { daily: 3 * DAY_MS, endless: 3 * DAY_MS };
/** The game's clock may run a little ahead of the server's (latency, rounding). */
export const SLACK_RATIO = 1.05;
export const SLACK_SECONDS = 5;
/** Firestore auto ids. */
export const TICKET_ID = /^[A-Za-z0-9]{20}$/;
/** Endless seeds: the range createEndlessSession draws from. */
export const newEndlessSeed = () => randomInt(1, 1e9);

const cantRank = () => new ApiError("invalid-argument", "That run can't be ranked.");

export async function handleStartRun(
  { auth, data },
  { tickets, limiter, now = Date.now, newSeed = newEndlessSeed },
) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to play a ranked run.");
  }
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const { mode } = body;
  if (!MODES.includes(mode)) throw new ApiError("invalid-argument", "That run can't be ranked.");
  const startedAt = now();
  let seed;
  if (mode === "daily") {
    seed = body.seed;
    if (!seedIsOpen(seed, startedAt)) {
      throw new ApiError("failed-precondition", "That daily challenge has closed.");
    }
  } else {
    seed = newSeed();
  }
  if (await limiter(auth.uid, "run", RUN_LIMIT)) {
    throw new ApiError("resource-exhausted", "Too many runs, try again in a minute.");
  }
  const expiresAt = startedAt + TICKET_TTL_MS[mode];
  const ticket = await tickets.create({
    uid: auth.uid,
    mode,
    seed,
    startedAt,
    expiresAt,
    // a Date, for the Firestore TTL policy that deletes old tickets
    expireAt: new Date(expiresAt),
    used: false,
  });
  return { ticket, seed, startedAt };
}

/** Null when `ticket` can rank this run, else why not (for tests and logs). */
export function ticketProblem(ticket, { uid, mode, seed, seconds, now }) {
  if (!ticket) return "missing";
  if (ticket.uid !== uid) return "not yours";
  if (ticket.mode !== mode || ticket.seed !== seed) return "another run";
  if (ticket.used) return "used";
  if (!(now <= ticket.expiresAt)) return "expired";
  const elapsed = (now - ticket.startedAt) / 1000;
  if (!(seconds <= elapsed * SLACK_RATIO + SLACK_SECONDS)) return "faster than real time";
  return null;
}

/** Uses the ticket up for this run, or refuses the run ("That run can't be ranked."). */
export async function claimTicket(tickets, id, run) {
  if (typeof id !== "string" || !TICKET_ID.test(id)) throw cantRank();
  const claimed = await tickets.claim(id, (ticket) => ticketProblem(ticket, run) === null);
  if (!claimed) throw cantRank();
}

/** Runs `store()` with the ticket claimed; gives the ticket back if storing fails. */
export async function withTicket(tickets, id, run, store) {
  await claimTicket(tickets, id, run);
  try {
    return await store();
  } catch (error) {
    await tickets.release(id).catch(() => {});
    throw error;
  }
}
