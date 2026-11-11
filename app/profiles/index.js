import { PROFILE_BATCH, profilePayload, cleanProfile } from "./rules";
import { firestoreProfiles } from "../firebase/profiles";

/**
 * Writing and reading player profiles (players/{uid}, see rules.js).
 *
 * sync() writes only this player's own profile, and only when it differs from
 * the last one written from this device for that uid, so reopening the game on
 * the same day writes nothing. A profile without seenDay is written at least
 * once a session all the same: another device may have written a seenDay since
 * this one last wrote, and the switch being off must clear it. A write the
 * rules refuse never blocks the next one: when one carrying seenDay is
 * refused (a device clock more than a day off), it is written again at once
 * without it, and no later write this session carries seenDay. A failed write is swallowed: nothing is shown,
 * the "last written" record stays as it was, and the next open or change tries
 * again. fetch() reads any number of profiles in batches and caches them for
 * the session; a failed read rejects and caches nothing.
 */
const RECORD_KEY = "profile";

const sameProfile = (a, b) =>
  !!a &&
  !!b &&
  ["skin", "hat", "companion", "seenDay"].every(
    (key) => Object.hasOwn(a, key) === Object.hasOwn(b, key) && a[key] === b[key],
  );

export function createProfiles({ backend, storage, now = Date.now }) {
  // writes one after another, so two quick changes can't race each other
  let chain = Promise.resolve();
  const cache = new Map(); // uid -> clean profile, or null when it has no document
  const writtenThisSession = new Set(); // uids this session has written a profile for
  let seenDayRefused = false; // the rules refused this session's seenDay: leave it out

  const lastWritten = () => {
    try {
      const record = JSON.parse(storage.getItem(RECORD_KEY));
      return record && typeof record === "object" ? record : null;
    } catch (error) {
      return null;
    }
  };

  const remember = (uid, payload) => {
    try {
      storage.setItem(RECORD_KEY, JSON.stringify({ uid, payload }));
    } catch (error) {
      // can't skip repeats without it, but the profile is still written
    }
  };

  async function run(uid, worn, { showLastSeen }) {
    if (typeof uid !== "string" || !uid) return;
    const payload = profilePayload(worn, {
      showLastSeen: !!showLastSeen && !seenDayRefused,
      now: now(),
    });
    const last = lastWritten();
    const trusted = Object.hasOwn(payload, "seenDay") || writtenThisSession.has(uid);
    if (trusted && last && last.uid === uid && sameProfile(last.payload, payload)) return;
    try {
      await backend.set(uid, payload);
    } catch (error) {
      if (error && error.code === "permission-denied" && Object.hasOwn(payload, "seenDay")) {
        seenDayRefused = true;
        console.warn("Profile: last-online day refused; writing the profile without it");
        return run(uid, worn, { showLastSeen: false });
      }
      return; // offline or refused: the record stays, so the next open or change retries
    }
    writtenThisSession.add(uid);
    remember(uid, payload);
    // the player's own row shows what was just written, not the look the board first read
    cache.set(uid, cleanProfile(payload));
  }

  function sync(uid, worn, options = {}) {
    const next = chain.then(() => run(uid, worn, options));
    chain = next;
    return next;
  }

  async function fetch(uids) {
    const wanted = [...new Set(Array.isArray(uids) ? uids : [])].filter(
      (uid) => typeof uid === "string" && uid,
    );
    const missing = wanted.filter((uid) => !cache.has(uid));
    const fetched = new Map();
    for (let i = 0; i < missing.length; i += PROFILE_BATCH) {
      const batch = missing.slice(i, i + PROFILE_BATCH);
      const rows = await backend.getMany(batch);
      for (const uid of batch) fetched.set(uid, null);
      for (const row of rows) {
        if (fetched.has(row.uid)) fetched.set(row.uid, cleanProfile(row.data));
      }
    }
    // cached only once every batch has answered: a failed read caches nothing
    for (const [uid, profile] of fetched) cache.set(uid, profile);
    const result = new Map();
    for (const uid of wanted) {
      if (cache.get(uid)) result.set(uid, cache.get(uid));
    }
    return result;
  }

  return { sync, fetch };
}

// localStorage itself can throw on access (blocked site data)
const deviceStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

export const profiles = createProfiles({ backend: firestoreProfiles, storage: deviceStorage });
