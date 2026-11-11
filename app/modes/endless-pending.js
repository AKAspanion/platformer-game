import { MIN_LEVEL, compareRuns } from "./endless-rules.js";
import { isFinalRefusal } from "../daily/pending.js";

/**
 * The best endless run that couldn't be sent (offline, server error), kept in
 * localStorage under "endless_pending" as { seed, level, score, seconds }
 * until the next home screen sends it.
 */

const STORAGE_KEY = "endless_pending";

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const isRun = (run) =>
  run &&
  typeof run === "object" &&
  Number.isInteger(run.seed) &&
  Number.isInteger(run.level) &&
  run.level >= MIN_LEVEL &&
  Number.isFinite(run.score) &&
  Number.isFinite(run.seconds);

const clean = ({ seed, level, score, seconds }) => ({ seed, level, score, seconds });

export function createEndlessPending(storage = defaultStorage()) {
  // Without any storage the run lives in memory for the session.
  let memory = null;

  const read = () => {
    if (!storage) return memory;
    try {
      const data = JSON.parse(storage.getItem(STORAGE_KEY));
      return isRun(data) ? clean(data) : null;
    } catch {
      return null; // missing, unreadable or corrupt: nothing waiting
    }
  };
  const write = (run) => {
    memory = run;
    if (!storage) return;
    try {
      if (run) storage.setItem(STORAGE_KEY, JSON.stringify(run));
      else storage.removeItem(STORAGE_KEY);
    } catch {
      // Storage full or blocked: the run is still sent from memory this session.
    }
  };

  return {
    save(input) {
      if (!isRun(input)) return;
      const run = clean(input);
      const old = read();
      if (old && compareRuns(old, run) <= 0) return;
      write(run);
    },

    async flush(send) {
      const result = { sent: 0, kept: 0, dropped: 0 };
      const run = read();
      if (!run) return result;
      let settled = false;
      try {
        await send(run);
        settled = true;
        result.sent += 1;
      } catch (error) {
        if (isFinalRefusal(error)) {
          settled = true; // the server will never take this run
          result.dropped += 1;
        } else {
          result.kept += 1; // offline or busy: the next home screen tries again
        }
      }
      if (settled) {
        // read again: a better run saved while sending stays
        const latest = read();
        if (!latest || compareRuns(latest, run) >= 0) write(null);
      }
      return result;
    },
  };
}
