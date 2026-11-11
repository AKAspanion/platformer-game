import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import Game from "../app/game";

// Its own file: the image registry is per process, and this test needs Coins
// and Water images nobody has asked for yet.

const noop = () => {};
const tick = () => new Promise((resolve) => setTimeout(resolve));

class HeldImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    HeldImage.held.push(this);
  }

  set src(value) {
    this._src = value;
    globalThis.__requested.push(value);
  }

  get src() {
    return this._src;
  }
}
HeldImage.held = [];

test("coins and water images never loaded: the bar shows; once in, a later setup is loaded at once", async () => {
  const real = globalThis.Image;
  globalThis.Image = HeldImage;
  const game = new Game(noop);
  try {
    game.world.reset();
    game.world.setup(areas[1]);
    assert.equal(game.world.coins.loaded, false, "coin frames in flight");
    assert.equal(game.world.isAssetsLoaded(), false, "bar shows");
    HeldImage.held.forEach((image) => image.onload());
  } finally {
    globalThis.Image = real;
  }
  Object.values(globalThis.__audios).forEach((audio) => audio.fire("canplaythrough"));
  await tick();
  assert.equal(game.isLoaded(), true, "bar gone once they land");

  const start = globalThis.__requested.length;
  game.world.reset();
  game.world.setup(areas[1]);
  assert.equal(game.world.coins.loaded, true, "coins in at setup");
  assert.equal(game.world.water.loaded, true, "water in at setup");
  assert.equal(game.world.isAssetsLoaded(), true);
  assert.deepEqual(
    globalThis.__requested.slice(start).filter((src) => /coin|water/.test(src)),
    [],
    "no image asked twice",
  );
});
