/** Lifetime stats the achievements count: kills per device, boss and world feats. */
import { createKeyStore, defaultStorage, deviceId, normalizeStats } from "./save";

const sum = (map) => Object.keys(map).reduce((total, key) => total + map[key], 0);

export function createStats(storage = defaultStorage(), device = deviceId(storage)) {
  const keep = createKeyStore(storage, "stats", normalizeStats);
  const update = (change) => {
    const state = keep.read();
    change(state);
    keep.write(state);
  };

  return {
    addKills(n) {
      if (!Number.isInteger(n) || n <= 0) return;
      update((state) => {
        state.kills[device] = (state.kills[device] || 0) + n;
      });
    },
    kills: () => sum(keep.read().kills),
    addBurned(n) {
      if (!Number.isInteger(n) || n <= 0) return;
      update((state) => {
        state.burned[device] = (state.burned[device] || 0) + n;
      });
    },
    burned: () => sum(keep.read().burned),
    bestCombo(value) {
      if (!Number.isFinite(value) || value <= keep.read().bestCombo) return;
      update((state) => (state.bestCombo = value));
    },
    markShieldlessBoss: () => update((state) => (state.shieldlessBoss = true)),
    endlessDeepest(level) {
      if (!Number.isFinite(level) || level <= keep.read().endlessDeepest) return;
      update((state) => (state.endlessDeepest = level));
    },
    markFlawlessBoss: () => update((state) => (state.flawlessBoss = true)),
    markSecretBoss: () => update((state) => (state.secretBoss = true)),
    finishWorld(worldId) {
      if (typeof worldId !== "string" || !worldId) return;
      update((state) => {
        if (!state.worldsFinished.includes(worldId)) state.worldsFinished.push(worldId);
      });
    },
    /** Keeps the fastest boss rush; returns the best time so far. */
    bossRushTime(seconds) {
      let best = keep.read().bossRushBest;
      if (Number.isFinite(seconds) && seconds > 0 && (best === null || seconds < best)) {
        best = seconds;
        update((state) => (state.bossRushBest = seconds));
      }
      return best;
    },
    read: () => keep.read(),
  };
}
