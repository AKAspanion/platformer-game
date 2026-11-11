import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import Game from "../app/game";
import World, { assetsOf } from "../app/game/world";
import Screen from "../app/screen";
import { tileSetFor } from "../app/screen/tileset";
import { preloadArea, preloaded, preloadedAudio, saveDataOn } from "../app/game/preload";
import { createEndlessSession } from "../app/modes";
import { registerSkin } from "../app/util/registry";

// These tests share one module graph (sprites are cached for the whole run, as
// in the browser), so each one uses levels no earlier test touched.

const requested = () => globalThis.__requested;
const mark = () => requested().length;
const since = (start) =>
  requested()
    .slice(start)
    .filter((src) => !/audio\/sfx\//.test(src)); // sound effects load on first play
const tick = () => new Promise((resolve) => setTimeout(resolve));
const noop = () => {};
const canvas = () => ({ getContext: () => ({}) });

/** Every music download "arrives" (fire() clears its listeners, so repeats are safe). */
const arriveAudio = () =>
  Object.values(globalThis.__audios).forEach((audio) => audio.fire("canplaythrough"));

/** An image whose download stays in flight until the test settles it. */
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
const holdImages = () => {
  const real = globalThis.Image;
  HeldImage.held = [];
  globalThis.Image = HeldImage;
  return () => {
    globalThis.Image = real;
  };
};
const settleHeld = (type) => {
  HeldImage.held.forEach((image) => image[type] && image[type]());
  HeldImage.held = [];
};

const setSaveData = (value) =>
  Object.defineProperty(globalThis.navigator, "connection", {
    value: { saveData: value },
    configurable: true,
  });

/** A game with level `id` set up and its music and sprites in. */
const openLevel = async (id) => {
  const game = new Game(noop);
  game.world.reset();
  game.world.setup(areas[id]);
  await tick();
  arriveAudio();
  assert.equal(game.isLoaded(), true, `level ${id} loaded`);
  return game;
};

const dupes = (list) => list.filter((src, i) => list.indexOf(src) !== i);

test("the next level's sprites and music are requested once each, once this level loads", async () => {
  const game = await openLevel(30);
  const next = assetsOf(areas[31]);
  assert.ok(
    next.images.some((s) => s.includes("boss/batLord/")),
    "next has a new boss",
  );
  assert.ok(next.audio.includes("./assets/audio/boss-batLord.mp3"));

  const start = mark();
  game.world.update(noop); // the level reports loaded: the preload starts
  const asked = since(start);
  assert.ok(
    asked.some((s) => s.includes("boss/batLord/")),
    "boss sprites",
  );
  assert.ok(asked.includes("./assets/audio/boss-batLord.mp3"), "boss music");
  assert.deepEqual(dupes(asked), [], "each url once");

  // and the preloader never asks again
  game.world.update(noop);
  game.world.update(noop);
  assert.deepEqual(since(start), asked);
});

test("no loading bar mid-level while the preload is in flight", async () => {
  const game = await openLevel(19);
  const release = holdImages();
  try {
    game.world.update(noop);
    for (let i = 0; i < 5; i++) {
      game.update();
      assert.equal(game.isLoaded(), true, `tick ${i}`);
    }
    assert.ok(HeldImage.held.length > 0, "the next level really is still downloading");
  } finally {
    release();
    settleHeld("onload");
  }
  await tick();
  assert.equal(game.isLoaded(), true);
});

test("a finished preload: the portal shows no loading bar", async () => {
  const game = await openLevel(30); // preloaded level 31 in the first test
  await tick();
  arriveAudio();
  const start = mark();
  game.world.reset();
  game.world.setup(areas[31]);
  assert.equal(game.isLoaded(), true, "game loaded the moment setup returns");
  const screen = new Screen(canvas(), areas[31].world, null);
  assert.equal(screen.isLoaded(), true, "tile set loaded");
  game.update();
  assert.equal(game.isLoaded() && screen.isLoaded(), true, "and on the first update");
  assert.deepEqual(
    since(start).filter((s) => /batLord/.test(s)),
    [],
    "nothing is asked twice",
  );
});

test("an unfinished preload: the bar shows until the image arrives, each image requested once", async () => {
  const game = await openLevel(26);
  const release = holdImages();
  const start = mark();
  try {
    game.world.update(noop); // starts preloading level 27 (frostSlime boss)
  } finally {
    release();
  }
  const held = [...HeldImage.held];
  assert.ok(held.length > 0);
  const preAsked = since(start).filter((s) => /frostSlime/.test(s));
  assert.ok(preAsked.length > 0);

  game.world.reset();
  game.world.setup(areas[27]);
  assert.equal(game.isLoaded(), false, "images still in flight");
  assert.deepEqual(
    since(start).filter((s) => /frostSlime/.test(s)),
    preAsked,
    "setup asks for nothing again",
  );

  // every image but one arrives
  const arriving = held.filter((image) => /frostSlime/.test(image.src));
  const [last, ...rest] = arriving;
  held.filter((image) => !arriving.includes(image)).forEach((image) => image.onload());
  rest.forEach((image) => image.onload());
  await tick();
  arriveAudio();
  assert.equal(game.isLoaded(), false, "one image is still out");
  last.onload();
  assert.equal(game.isLoaded(), true);
  assert.deepEqual(dupes(since(start)), []);
});

test("a preloaded image that fails still counts as in", async () => {
  const game = await openLevel(28);
  const release = holdImages();
  try {
    game.world.update(noop); // preloads level 29 (sandLizard boss)
  } finally {
    release();
  }
  game.world.reset();
  game.world.setup(areas[29]);
  assert.equal(game.isLoaded(), false);
  settleHeld("onerror");
  await tick();
  arriveAudio();
  assert.equal(game.isLoaded(), true);
  assert.doesNotThrow(() => game.update());
});

test("with save-data on, nothing preloads", async () => {
  const game = await openLevel(31);
  setSaveData(true);
  try {
    assert.equal(saveDataOn(), true);
    assert.equal(preloadArea(areas[21]), null);
    const start = mark();
    game.world.update(noop);
    game.world.update(noop);
    assert.deepEqual(since(start), []);
  } finally {
    setSaveData(false);
  }
  assert.equal(saveDataOn(), false);
});

test("a missing area preloads nothing", () => {
  assert.equal(preloadArea(undefined), null);
});

test("an endless run preloads the level one ahead", async () => {
  const session = createEndlessSession(1234);
  const first = session.startId;
  assert.ok(areas[first + 1], "the next level is already built");
  const game = new Game(noop);
  game.world.reset();
  game.world.setup(areas[first]);
  await tick();
  arriveAudio();
  game.world.update(noop);
  const next = assetsOf(areas[first + 1]);
  next.images.forEach((src) => assert.ok(preloaded(src), src));
  next.audio.forEach((src) => assert.ok(globalThis.__audios[src], src));
  assert.equal(tileSetFor(16, 8, areas[first + 1].world).tileSize, 16);
});

test("a community world needs only its music: no tile or sprite file", async () => {
  registerSkin("preload-test-skin", { tiles: [null], objects: [null], background: {} });
  areas[9001] = {
    ...areas[14],
    id: 9001,
    skin: "preload-test-skin",
    theme: "tracktest",
    enemies: [],
  };
  areas[9000] = {
    ...areas[14],
    id: 9000,
    portals: areas[14].portals.map((p) => (p.direction > 0 ? { ...p, destinationArea: 9001 } : p)),
  };
  try {
    const game = await openLevel(9000);
    const start = mark();
    game.world.update(noop);
    assert.deepEqual(since(start), ["./assets/audio/tracktest.mp3"]);
    await tick();
    arriveAudio();
    assert.equal(preloadedAudio("./assets/audio/tracktest.mp3"), true);
  } finally {
    delete areas[9000];
    delete areas[9001];
  }
});

test("two portals in a row within a world reuse one loaded tile set", async () => {
  const game = await openLevel(7); // grassland, forward to 9 (grassland)
  game.world.update(noop);
  await tick();
  const a = new Screen(canvas(), areas[7].world, null);
  const b = new Screen(canvas(), areas[9].world, null);
  assert.equal(a.tileSet, b.tileSet);
  assert.equal(b.isLoaded(), true);
  assert.equal(tileSetFor(16, 8, 1), a.tileSet);
});

test("the last boss's exit preloads nothing", async () => {
  const game = await openLevel(33);
  const start = mark();
  game.world.update(noop);
  game.world.update(noop);
  assert.deepEqual(since(start), []);
});

test("assetsFor still lists what an area needs", () => {
  const world = new World();
  assert.deepEqual(world.assetsFor(areas[25]), assetsOf(areas[25]));
});
