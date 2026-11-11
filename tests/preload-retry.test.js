import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import Game from "../app/game";
import { requestImage } from "../app/game/preload";

// Its own file: the image registry is per process.

const noop = () => {};

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

const withHeld = (fn) => {
  const real = globalThis.Image;
  globalThis.Image = HeldImage;
  try {
    return fn();
  } finally {
    globalThis.Image = real;
  }
};

const asks = (src) => globalThis.__requested.filter((url) => url === src).length;

test("a sprite that fails is asked for again, and a good one is kept", () => {
  const src = "retry-sprite.png";
  const counts = { assetCount: 0, loadCount: 0 };
  withHeld(() => {
    requestImage(src, counts);
    HeldImage.held[HeldImage.held.length - 1].onerror();
    assert.equal(counts.loadCount, 1, "a failure counts as in for that level");
    requestImage(src, counts);
    assert.equal(asks(src), 2, "fail: asked again");
    HeldImage.held[HeldImage.held.length - 1].onerror();
    requestImage(src, counts);
    assert.equal(asks(src), 3, "fail again: asked again");
    HeldImage.held[HeldImage.held.length - 1].onload();
    requestImage(src, counts);
    requestImage(src, counts);
    assert.equal(asks(src), 3, "loaded: kept, no new request");
  });
});

test("a coin frame that fails is asked for again on the next setup, then kept once it loads", () => {
  const game = new Game(noop);
  const coinAsks = () => globalThis.__requested.filter((src) => /coin/.test(src)).length;
  withHeld(() => {
    game.world.reset();
    game.world.setup(areas[1]);
    const first = coinAsks();
    assert.ok(first > 0, "coin frames requested");
    HeldImage.held.forEach((image) => image.onerror());
    HeldImage.held.length = 0;

    game.world.reset();
    game.world.setup(areas[1]);
    assert.equal(coinAsks(), first * 2, "failed frames requested again");
    assert.equal(game.world.coins.loaded, false, "in flight again");
    HeldImage.held.forEach((image) => image.onload());
    HeldImage.held.length = 0;
    assert.equal(game.world.coins.loaded, true);

    game.world.reset();
    game.world.setup(areas[1]);
    assert.equal(coinAsks(), first * 2, "good frames reused");
    assert.equal(game.world.coins.loaded, true);
  });
});
