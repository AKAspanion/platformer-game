/**
 * When this device may write the player's profile: only for the account cloud
 * save is running for, and only once cloud save has merged that account's save
 * here, so the worn items and the last-online switch it writes are the
 * account's, not a fresh or stale device's defaults.
 *
 *   start(uid)   cloud save starts for uid: hold writes until its save merges
 *   merged(uid)  cloud save merged uid's save (cloud.js onMerge, after its
 *                start and each push): write now
 *   changed()    write now, if merged (the game instead sends the save on a
 *                worn or switch change, so its write follows a fresh merge)
 *   stop()       signed out: write nothing
 *
 * `read()` gives { worn, showLastSeen } from the device, at the moment of the
 * write; `sync(uid, worn, options)` is profiles.sync.
 */
export function createProfileGate({ sync, read }) {
  let uid = null;
  let ready = false;

  const write = () => {
    if (uid === null || !ready) return null;
    const { worn, showLastSeen } = read();
    return sync(uid, worn, { showLastSeen });
  };

  return {
    start(account) {
      uid = typeof account === "string" && account ? account : null;
      ready = false;
    },
    merged(account) {
      if (uid === null || account !== uid) return null;
      ready = true;
      return write();
    },
    changed: write,
    stop() {
      uid = null;
      ready = false;
    },
  };
}
