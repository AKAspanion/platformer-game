/**
 * The wallet: coins earned (counted per device, so two devices never
 * overwrite each other), achievement rewards, owned and worn cosmetics.
 *
 * balance = coins earned + rewards - prices of the items owned, never below
 * 0. If purchases on two devices merge into a debt, the balance shows 0,
 * every item stays owned, and new coins pay the difference off first.
 */
import { createKeyStore, defaultStorage, deviceId, normalizeWallet } from "./save";
import { FREE, itemOf } from "../shop/catalog";

const sum = (map) => Object.keys(map).reduce((total, key) => total + map[key], 0);
const key = (slot, id) => `${slot}:${id}`;
const isCoins = (n) => Number.isInteger(n) && n > 0;

export function createWallet(storage = defaultStorage(), device = deviceId(storage)) {
  const keep = createKeyStore(storage, "wallet", normalizeWallet);

  const owns = (state, slot, id) => FREE[slot] === id || state.owned.includes(key(slot, id));
  const spent = (state) =>
    state.owned.reduce((total, owned) => {
      const [slot, ...rest] = owned.split(":");
      const item = itemOf(slot, rest.join(":"));
      return total + (item ? item.price : 0);
    }, 0);
  const balanceOf = (state) => Math.max(0, sum(state.earned) + sum(state.rewards) - spent(state));

  return {
    balance: () => balanceOf(keep.read()),
    earned: () => sum(keep.read().earned),
    earn(coins) {
      if (!isCoins(coins)) return;
      const state = keep.read();
      state.earned[device] = (state.earned[device] || 0) + coins;
      keep.write(state);
    },
    /** Pays an achievement's coins once; false if it was paid before. */
    reward(achievementId, coins) {
      const state = keep.read();
      if (achievementId in state.rewards || !(Number.isFinite(coins) && coins >= 0)) return false;
      state.rewards[achievementId] = coins;
      keep.write(state);
      return true;
    },
    owns: (slot, id) => !!itemOf(slot, id) && owns(keep.read(), slot, id),
    buy(slot, id) {
      const item = itemOf(slot, id);
      const state = keep.read();
      if (!item || owns(state, slot, id)) return { ok: false, need: 0 };
      const balance = balanceOf(state);
      if (balance < item.price) return { ok: false, need: item.price - balance };
      state.owned.push(key(slot, id));
      keep.write(state);
      return { ok: true };
    },
    wear(slot, id) {
      const state = keep.read();
      if (!itemOf(slot, id) || !owns(state, slot, id)) return false;
      state.worn[slot] = id;
      state.wornAt = Date.now();
      keep.write(state);
      return true;
    },
    worn: () => ({ ...keep.read().worn }),
  };
}
