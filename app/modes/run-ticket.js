/**
 * Run tickets (functions/src/runs.js): a ranked daily or endless run starts on
 * the server, which notes the start time and, for endless, picks the seed. A
 * run without a ticket (offline at the start, server busy) still plays; it just
 * isn't ranked.
 *
 *   const tickets = createRunTickets({ call, ensurePlayer })
 *   await tickets.start("endless")                         -> { ticket, seed } | null
 *   await tickets.start("daily", seed, { wait: Infinity }) -> { ticket, seed } | null
 *
 * `call(name, data)` runs a callable function; `ensurePlayer()` signs in an
 * anonymous player if nobody is signed in (the ticket belongs to an account).
 */

/** How long starting an endless run waits for the server's seed before playing unranked. */
export const TICKET_WAIT_MS = 4000;

const isTicket = (out) =>
  !!out && typeof out.ticket === "string" && out.ticket.length > 0 && Number.isInteger(out.seed);

export function createRunTickets({ call, ensurePlayer, setTimer = setTimeout }) {
  return {
    start(mode, seed, { wait = TICKET_WAIT_MS } = {}) {
      const request = (async () => {
        await ensurePlayer();
        const out = await call("startRun", mode === "daily" ? { mode, seed } : { mode });
        return isTicket(out) ? { ticket: out.ticket, seed: out.seed } : null;
      })().catch(() => null);
      if (!Number.isFinite(wait)) return request;
      const late = new Promise((resolve) => setTimer(() => resolve(null), wait));
      return Promise.race([request, late]);
    },
  };
}
