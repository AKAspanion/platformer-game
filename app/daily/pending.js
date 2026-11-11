import { seedIsOpen } from "./rules.js";

/**
 * The daily run that couldn't be sent (offline, server error): one per seed,
 * the best one, kept in localStorage under "daily_pending" as
 * { [seed]: { seed, score, seconds, ticket } } until the next home screen sends it.
 * The run's ticket (app/modes/run-ticket.js) travels with it: the server ranks
 * nothing without one.
 */

const STORAGE_KEY = "daily_pending";

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The callable error's code without its "functions/" prefix, "" when it has none. */
export const errorCode = (error) => String((error && error.code) || "").replace(/^functions\//, "");

/** Refusals that can never succeed on a later try: the run is not worth keeping. */
export const isFinalRefusal = (error) =>
  ["invalid-argument", "failed-precondition"].includes(errorCode(error));

const isRun = (run) =>
  run &&
  typeof run === "object" &&
  Number.isInteger(run.seed) &&
  Number.isFinite(run.score) &&
  Number.isFinite(run.seconds) &&
  (run.ticket === undefined || typeof run.ticket === "string");

export function createPending(storage = defaultStorage()) {
  // Without any storage the runs live in memory for the session.
  let memory = {};

  const read = () => {
    if (!storage) return { ...memory };
    try {
      const data = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      return Object.fromEntries(Object.entries(data).filter(([, run]) => isRun(run)));
    } catch {
      return {}; // missing, unreadable or corrupt: nothing waiting
    }
  };
  const write = (runs) => {
    memory = runs;
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(runs));
    } catch {
      // Storage full or blocked: the run is still sent from memory this session.
    }
  };

  return {
    save({ seed, score, seconds, ticket }) {
      const run =
        ticket === undefined ? { seed, score, seconds } : { seed, score, seconds, ticket };
      if (!isRun(run)) return;
      const runs = read();
      const old = Object.hasOwn(runs, seed) ? runs[seed] : null;
      if (old && old.score >= score) return;
      runs[seed] = run;
      write(runs);
    },

    async flush(send, now = Date.now()) {
      const result = { sent: 0, kept: 0, dropped: 0 };
      const settled = [];
      const runs = read();
      for (const key of Object.keys(runs)) {
        const run = runs[key];
        if (!seedIsOpen(run.seed, now)) {
          settled.push(key);
          result.dropped += 1;
          continue;
        }
        try {
          await send(run);
          settled.push(key);
          result.sent += 1;
        } catch (error) {
          if (isFinalRefusal(error)) {
            settled.push(key); // the server will never take this run
            result.dropped += 1;
          } else {
            result.kept += 1; // offline or busy: the next home screen tries again
          }
        }
      }
      // read again: a run saved while sending stays, and so does a better one for a sent seed
      const latest = read();
      for (const key of settled) {
        if (Object.hasOwn(latest, key) && latest[key].score <= runs[key].score) delete latest[key];
      }
      write(latest);
      return result;
    },
  };
}
