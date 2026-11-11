/**
 * Cloud save: keeps the signed-in (or anonymous) account's save document in
 * step with this device's progress. It only merges, never overwrites, so
 * nothing from either side is lost, and it never shows an error: a save that
 * can't be sent stays on the device and the next change or start sends it.
 *
 * Every write is one read-merge-write of the account's save (backend.update,
 * a transaction): a push from a device whose session predates another
 * device's change merges that change in, and takes it, rather than sending
 * its stale copy over it. A reset replaces the account's progress but still
 * merges the last-online switch, a setting a reset never turns back on.
 *
 * Callers create it only for a player who already has an account; this module
 * never creates one and loads nothing itself (the backend loads Firebase).
 *
 * onMerge(uid), optional, runs after each read-merge-write that went through
 * (the start, each push, a reset), never after a failed one or for an account
 * that has since been replaced: the profile is written from what it merged.
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
  let dirty = false; // something here isn't in the account's save yet
  let edits = 0; // bumped by each change, so one made mid-exchange stays pending
  let timer = null;
  let chain = Promise.resolve();

  const cancelTimer = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };

  // This device's progress with the account's save `theirs` (null: none yet)
  // merged in, and whether the account lacks any of it. Replacing (a reset)
  // keeps this device's progress, but the later switch of the two.
  function mergedWith(device, theirs, replacing) {
    if (!theirs) return { merged: device, send: true };
    const both = mergeProgress(device, theirs);
    if (replacing) return { merged: { ...device, lastSeen: both.lastSeen }, send: true };
    return { merged: both, send: fingerprint(both) !== fingerprint(theirs) };
  }

  // One read-merge-write of the account's save, then the merge comes back to
  // this device. A save over the size limit is not sent and not retried: the
  // game keeps playing from the device copy. A failure leaves it pending.
  async function exchange(replacing) {
    const mine = uid;
    const id = run;
    const edit = edits;
    if (mine === null) return;
    dirty = true;
    let merged = null; // what the step that committed merged
    try {
      await backend.update(mine, (remote) => {
        if (id !== run) return null; // stopped or restarted: write nothing
        const device = local.read();
        const theirs = remote && remote.data ? remote.data : null;
        const step = mergedWith(device, theirs, replacing);
        merged = step.merged;
        if (!step.send) return null;
        const data = { ...merged, updatedAt: now() };
        if (saveBytes(data) > MAX_SAVE_BYTES) return null;
        return { v: SAVE_VERSION, updatedAt: now(), data };
      });
    } catch (error) {
      return; // stays dirty: a later start, change or flush retries
    }
    if (id !== run || merged === null) return;
    const device = local.read();
    const next = mergeProgress(device, merged);
    if (fingerprint(next) !== fingerprint(device)) local.write(next);
    if (edits === edit) dirty = false;
    if (onMerge) {
      try {
        onMerge(mine);
      } catch (error) {
        console.warn("Cloud save: after-merge step failed:", error && error.name);
      }
    }
  }

  const sync = () => exchange(false);

  // Replaces the account's progress with this device's (reset) progress,
  // without merging the old progress back; if it fails, the next push merges,
  // where the later reset wins.
  const replace = () => {
    cancelTimer();
    return exchange(true);
  };

  // Jobs run one at a time so a slow one can't land after a newer one.
  const queue = (job) => {
    chain = chain.then(job, job);
    return chain;
  };

  return {
    start(account) {
      cancelTimer();
      uid = account;
      run += 1;
      return queue(sync);
    },
    changed() {
      if (uid === null) return;
      dirty = true;
      edits += 1;
      cancelTimer();
      timer = clock.setTimeout(() => {
        timer = null;
        queue(sync);
      }, SAVE_DELAY);
    },
    reset() {
      return queue(replace);
    },
    flush() {
      if (uid === null || !dirty) return chain;
      cancelTimer();
      return queue(sync);
    },
    stop() {
      cancelTimer();
      uid = null;
      dirty = false;
      run += 1;
    },
    status() {
      if (uid === null) return "device";
      return dirty ? "pending" : "saved";
    },
  };
}
