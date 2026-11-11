/**
 * "Show when I was last online": a setting of the account, not of the device.
 * It rides in cloud save (save.js, key "last_seen"), where the latest change
 * wins by its changedAt stamp, so turning it off on one device turns it off on
 * every device once each merges the account's save. On until the player turns
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
      if (keep.read().on === value) return false;
      keep.write({ on: value, changedAt: now() });
      return true;
    },
  };
}
