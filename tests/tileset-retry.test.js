import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { tileSetFor } from "../app/screen/tileset";

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
  HeldImage.held = [];
  try {
    return fn();
  } finally {
    globalThis.Image = real;
  }
};
const worldFiles = (world, start) =>
  globalThis.__requested.slice(start).filter((src) => src.includes(`world-${world}/`));

test("a tile set whose download failed is asked for again; a good one is kept", () => {
  let start = globalThis.__requested.length;
  const first = withHeld(() => tileSetFor(16, 8, 2));
  const files = worldFiles(2, start);
  assert.ok(files.length > 0, "tiles requested");
  // one tile fails, the rest arrive: the level still starts
  HeldImage.held.forEach((image, i) => (i === 3 ? image.onerror() : image.onload()));
  assert.equal(first.loaded, true, "a failed download counts as in for this level");

  start = globalThis.__requested.length;
  const second = withHeld(() => tileSetFor(16, 8, 2));
  assert.notEqual(second, first, "the broken set is not reused");
  assert.deepEqual(worldFiles(2, start).sort(), files.sort(), "every tile asked for again");

  // this time everything arrives: kept and reused
  HeldImage.held.forEach((image) => image.onload());
  start = globalThis.__requested.length;
  const third = withHeld(() => tileSetFor(16, 8, 2));
  assert.equal(third, second);
  assert.deepEqual(worldFiles(2, start), [], "nothing asked");
});

test("a tile set still downloading is shared, not asked twice", () => {
  const first = withHeld(() => tileSetFor(16, 8, 3));
  const start = globalThis.__requested.length;
  const again = withHeld(() => tileSetFor(16, 8, 3));
  assert.equal(again, first);
  assert.deepEqual(worldFiles(3, start), []);
});
