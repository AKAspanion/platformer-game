/**
 * Turns the world's running counters into coins and kills gained since the
 * last tick. The world's counters belong to the run (they carry from level to
 * level and drop back to 0 on a retry), so each tick only pays the increase.
 */
const count = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);

/** Coins and kills gained since the last call for this level; a new level or a reset world starts from 0. */
export function createEarnings() {
  let last = null; // { id, coins, kills } as of the previous tick

  return {
    tick(world) {
      const now = {
        id: world.id,
        coins: count(world.totalCoins),
        kills: count(world.totalEnemies),
      };
      const same = last !== null && last.id === now.id;
      const gained = {
        coins: same ? Math.max(0, now.coins - last.coins) : 0,
        kills: same ? Math.max(0, now.kills - last.kills) : 0,
      };
      last = now;
      return gained;
    },
  };
}
