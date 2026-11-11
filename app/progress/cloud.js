/**
 * Cloud save: keeps the signed-in (or anonymous) account's save document in
 * step with this device's progress. It only merges, never overwrites, so
 * nothing from either side is lost, and it never shows an error: a save that
 * can't be sent stays on the device and the next change or start sends it.
 *
 * Callers create it only for a player who already has an account; this module
 * never creates one and loads nothing itself (the backend loads Firebase).
 *
 * onMerge(uid), optional, runs after each pull that merged the account's save
 * into this device (or found none), never after a failed pull or for an
 * account that has since been replaced: the profile waits for it.
 */
import { mergeProgress, emptyProgress, saveBytes, MAX_SAVE_BYTES, SAVE_VERSION } from "./save";

export const SAVE_DELAY = 5000;

// A progress as a comparable string, ignoring the sync stamp.
const fingerprint = (progress) =>
  JSON.stringify({ ...mergeProgress(progress, emptyProgress()), updatedAt: 0 });

export function createCloudSave({ backend, local, timers, now = Date.now, onMerge }) {
  const clock = timers || {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  let uid = null;
  let run = 0; // bumped by start and stop so a stale async step gives up
  let pulled = false; // the account's save has been merged in this run
  let dirty = false; // something here isn't in the account's save yet
  let timer = null;
  let chain = Promise.resolve();

  const cancelTimer = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };

  // Sends `progress` stamped now. A save over the size limit is not sent and
  // not retried: the game keeps playing from the device copy. False when a
  // send failed and should be retried.
  async function send(mine, progress) {
    if (saveBytes(progress) > MAX_SAVE_BYTES) return true;
    try {
      await backend.set(mine, { v: SAVE_VERSION, updatedAt: now(), data: progress });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Pull, merge, write local if it gained anything, push if the account lacks something.
  async function sync() {
    const mine = uid;
    const id = run;
    if (mine === null) return;
    dirty = true;
    let remote;
    try {
      remote = await backend.get(mine);
    } catch (error) {
      return; // stays dirty: a later start or change retries
    }
    if (id !== run) return;
    const device = local.read();
    const theirs = remote && remote.data ? remote.data : null;
    const merged = theirs ? mergeProgress(device, theirs) : device;
    if (fingerprint(merged) !== fingerprint(device)) local.write(merged);
    pulled = true;
    dirty = false;
    if (onMerge) {
      try {
        onMerge(mine);
      } catch (error) {
        console.warn("Cloud save: after-merge step failed:", error && error.name);
      }
    }
    if (theirs && fingerprint(merged) === fingerprint(theirs)) return;
    if (!(await send(mine, { ...merged, updatedAt: now() })) && id === run) dirty = true;
  }

  async function push() {
    const mine = uid;
    const id = run;
    if (mine === null) return;
    if (!pulled) return sync(); // never overwrite an account save we haven't merged
    dirty = false;
    if (!(await send(mine, { ...local.read(), updatedAt: now() })) && id === run) dirty = true;
  }

  // Replaces the account's save with this device's (reset) progress, without
  // merging the old one back. If the send fails the account is not known to
  // match, so the next push pulls and merges first, where the later reset wins.
  async function replace() {
    const mine = uid;
    const id = run;
    if (mine === null) return;
    cancelTimer();
    dirty = true;
    if (await send(mine, { ...local.read(), updatedAt: now() })) {
      if (id === run) {
        pulled = true;
        dirty = false;
      }
    }
  }

  // Jobs run one at a time so a slow one can't land after a newer one.
  const queue = (job) => {
    chain = chain.then(job, job);
    return chain;
  };

  return {
    start(account) {
      cancelTimer();
      uid = account;
      pulled = false;
      run += 1;
      return queue(sync);
    },
    changed() {
      if (uid === null) return;
      dirty = true;
      cancelTimer();
      timer = clock.setTimeout(() => {
        timer = null;
        queue(push);
      }, SAVE_DELAY);
    },
    reset() {
      return queue(replace);
    },
    flush() {
      if (uid === null || !dirty) return chain;
      cancelTimer();
      return queue(push);
    },
    stop() {
      cancelTimer();
      uid = null;
      pulled = false;
      dirty = false;
      run += 1;
    },
    status() {
      if (uid === null) return "device";
      return dirty ? "pending" : "saved";
    },
  };
}
