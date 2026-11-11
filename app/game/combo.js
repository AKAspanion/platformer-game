/**
 * The combo meter: each kill or coin within 2 seconds of the last adds 1;
 * from 5 the score from kills and coins is multiplied (x2, then x3 from 10,
 * x4 from 20). It multiplies score only, never wallet coins.
 */
export const COMBO_WINDOW = 60; // ticks (2 s)
export const TIERS = [
  [20, 4],
  [10, 3],
  [5, 2],
]; // [combo reached, multiplier], highest first

export function multiplierFor(count) {
  const tier = TIERS.find(([reached]) => count >= reached);
  return tier ? tier[1] : 1;
}

export default class Combo {
  constructor() {
    this.resetLevel();
  }

  /** A kill or coin: adds a step and returns what it came to. */
  step() {
    const before = this.multiplier;
    this.count += 1;
    this.best = Math.max(this.best, this.count);
    this.multiplier = multiplierFor(this.count);
    this.left = COMBO_WINDOW;
    return { count: this.count, multiplier: this.multiplier, tierUp: this.multiplier > before };
  }

  tick() {
    if (this.count === 0) return;
    this.left -= 1;
    if (this.left <= 0) this.end();
  }

  /** The combo is over (time ran out, or a heart was lost); `best` stays. */
  end() {
    this.count = 0;
    this.multiplier = 1;
    this.left = 0;
  }

  resetLevel() {
    this.count = 0;
    this.best = 0;
    this.multiplier = 1;
    this.left = 0;
  }
}
