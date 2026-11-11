/**
 * The daily and endless boards' only read path, free of Firebase so it can be
 * tested on its own (tests/boards-functions.test.js). index.js wires it to
 * Firestore.
 *
 *   handleGetDailyBoard({ auth, data: { seed } }, { scores, log, now })
 *     -> { top: [{ uid, name, score, seconds }], me: { uid, name, score, seconds } | null }
 *   handleGetEndlessBoard({ auth }, { board, log })
 *     -> { top: [{ uid, name, level, score, seconds }], me: { ... } | null }
 *
 * `scores` (Firestore: daily/{seed}/scores/{uid}) and `board` (endless/{uid}),
 * read with a field mask of DAILY_FIELDS / ENDLESS_FIELDS:
 *   scores.top(seed, count) / board.top(count) -> [{ uid, data }] best first
 *   scores.get(seed, uid)   / board.get(uid)   -> { uid, data } | null
 *
 * Clients never read the board documents themselves (firestore.rules):
 * Firestore gives every reader a document's create and update times, which
 * would show when each player's improving run happened. This hands out, field
 * by field, only what a board shows, for the top BOARD_TOP and the caller's own
 * entry (signed in, anonymous included), and never another player's entry
 * outside the top. Boards stay viewable signed out; `me` is null then. It
 * never writes. The request is untrusted: daily reads only its own `seed`, an
 * open day's (yesterday, today or tomorrow by UTC, as submitDailyScore takes);
 * endless reads nothing from it. Stored entries are checked too: one that
 * isn't a board entry is left out and logged.
 */
import { seedIsOpen } from "../shared/daily/rules.js";
import { compareRuns } from "../shared/modes/endless-rules.js";
import { ApiError } from "./handlers.js";
import { outranks } from "./daily.js";

/** How many entries a board call hands out, best first. */
export const BOARD_TOP = 50;
/** The stored fields a board reads (the uid is the document id). */
export const DAILY_FIELDS = ["name", "score", "seconds"];
export const ENDLESS_FIELDS = ["name", "level", "score", "seconds"];

const callerUid = (auth) =>
  auth && typeof auth.uid === "string" && auth.uid.length > 0 ? auth.uid : null;

const isScore = (n) => Number.isInteger(n) && n >= 0;
const isSeconds = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** A stored daily entry as the board shows it, or null when it isn't one. */
function dailyEntry(row) {
  const data = row && row.data;
  if (!row || typeof row.uid !== "string" || !row.uid || !data || typeof data !== "object") {
    return null;
  }
  const { name, score, seconds } = data;
  if (typeof name !== "string" || !isScore(score) || !isSeconds(seconds)) return null;
  return { uid: row.uid, name, score, seconds };
}

/** A stored endless entry as the board shows it, or null when it isn't one. */
function endlessEntry(row) {
  const entry = dailyEntry(row);
  const level = entry && row.data.level;
  if (!entry || !Number.isInteger(level) || level < 1) return null;
  return { uid: entry.uid, name: entry.name, level, score: entry.score, seconds: entry.seconds };
}

/**
 * The top BOARD_TOP and the caller's own entry. The store already orders and
 * limits; sorting again (stable, so the store's tie order holds) keeps a board
 * in order whatever it hands back.
 */
async function readBoard({ uid, kind, toEntry, better, top, get, log }) {
  const shown = (row) => {
    const entry = toEntry(row);
    // no uid or name in the log: only the board and that an entry was dropped
    if (!entry && row) log(`${kind} board: a stored entry isn't a board entry, left out`);
    return entry;
  };
  const rows = (await top(BOARD_TOP)) || [];
  const entries = rows
    .map(shown)
    .filter(Boolean)
    .sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0))
    .slice(0, BOARD_TOP);
  if (!uid) return { top: entries, me: null };
  const inTop = entries.find((entry) => entry.uid === uid);
  if (inTop) return { top: entries, me: inTop };
  const own = await get(uid);
  const me = own && own.uid === uid ? shown(own) : null;
  return { top: entries, me };
}

export async function handleGetDailyBoard({ auth, data }, { scores, log, now = Date.now }) {
  // only the request's own seed: never an inherited one, never anything else
  const seed = data && typeof data === "object" && Object.hasOwn(data, "seed") ? data.seed : null;
  if (!Number.isInteger(seed) || !seedIsOpen(seed, now())) {
    throw new ApiError("invalid-argument", "That day's board isn't open.");
  }
  return readBoard({
    uid: callerUid(auth),
    kind: "daily",
    toEntry: dailyEntry,
    better: outranks,
    top: (count) => scores.top(seed, count),
    get: (uid) => scores.get(seed, uid),
    log,
  });
}

export async function handleGetEndlessBoard({ auth }, { board, log }) {
  return readBoard({
    uid: callerUid(auth),
    kind: "endless",
    toEntry: endlessEntry,
    better: (a, b) => compareRuns(a, b) < 0,
    top: (count) => board.top(count),
    get: (uid) => board.get(uid),
    log,
  });
}
