import { PROFILE_BATCH, profilePayload, cleanProfile } from "./rules";
import { firestoreProfiles } from "../firebase/profiles";

/**
 * Writing and reading player profiles (players/{uid}, see rules.js).
 *
 * sync() writes only this player's own profile, and only when it differs from
 * the last one written from this device for that uid, so reopening the game on
 * the same day writes nothing. A failed write is swallowed: nothing is shown,
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
    const payload = profilePayload(worn, { showLastSeen: !!showLastSeen, now: now() });
    const last = lastWritten();
    if (last && last.uid === uid && sameProfile(last.payload, payload)) return;
    try {
      await backend.set(uid, payload);
    } catch (error) {
      return; // offline or refused: the record stays, so the next open or change retries
    }
    remember(uid, payload);
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
