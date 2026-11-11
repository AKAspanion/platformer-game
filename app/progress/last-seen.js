/**
 * "Show when I was last online": a setting of the account, not of the device.
 * It rides in cloud save (save.js, key "last_seen"), where the latest change
 * wins by its changedAt stamp, so turning it off on one device turns it off on
 * every device once each merges the account's save (each start and each push
 * merges it, so a device mid-session takes a change made elsewhere at its next
 * push and never sends its older value back). On until the player turns
 * it off; a fresh install is on only until its first merge.
 */
import { createKeyStore, defaultStorage, normalizeLastSeen } from "./save";

export function createLastSeen(storage = defaultStorage(), now = Date.now) {
  const keep = createKeyStore(storage, "last_seen", normalizeLastSeen);
  return {
    on: () => keep.read().on,
    /** True when it changed: the caller then sends the save and writes the profile. */
    set(on) {
      const value = !!on;
      const current = keep.read();
      if (current.on === value) return false;
      // a change outranks the one it replaced, even on a clock that is behind
      keep.write({ on: value, changedAt: Math.max(now(), current.changedAt + 1) });
      return true;
    },
  };
}
