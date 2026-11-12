import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import Screen from "../app/screen";
import GameEngine from "../app/engine";
import StillFrame from "../app/engine/still-frame";

const WORLD = { width: 336, height: 192 };

/** A canvas whose 2D context records scale() and drawImage() calls. */
function fakeCanvas() {
  const canvas = { style: {}, width: 300, height: 150 };
  const ctx = {
    canvas,
    calls: [],
    scaleX: 1,
    scale(x) {
      this.scaleX *= x;
    },
    drawImage(source) {
      this.calls.push(source);
    },
  };
  canvas.getContext = () => ctx;
  return { canvas, ctx };
}

function phoneScreen(dpr = 3) {
  globalThis.window = { ...(globalThis.window || {}), devicePixelRatio: dpr };
  globalThis.document = { documentElement: { style: { setProperty() {} } } };
  const { canvas, ctx } = fakeCanvas();
  const skin = { tiles: [], objects: [], background: { tag: "backdrop" } };
  const screen = new Screen(canvas, 1, skin);
  // what resize() does on a phone in landscape
  canvas.width = WORLD.width; // setting a canvas size resets its context
  ctx.scaleX = 1;
  screen.resize(874, 402, WORLD.width, WORLD.height);
  return { screen, canvas, ctx };
}

// ------------------------------------------------------------- the canvas

test("the world is drawn straight at the canvas's full size", () => {
  const { canvas, ctx } = phoneScreen(3);
  assert.equal(ctx.scaleX, canvas.width / WORLD.width, "one world pixel covers the canvas");
});

test("a frame never copies the whole canvas onto itself", () => {
  const { screen, canvas, ctx } = phoneScreen(3);
  screen.drawBackground();
  if (typeof screen.render === "function") screen.render();
  assert.ok(!ctx.calls.includes(canvas), "no canvas-to-itself copy");
});

// ------------------------------------------------------------- the engine

function runEngine(frameMs, totalMs) {
  let frame = null;
  globalThis.window = {
    requestAnimationFrame: (fn) => {
      frame = fn;
      return 1;
    },
    cancelAnimationFrame: () => {},
    performance: { now: () => 0 },
  };
  let renders = 0;
  const engine = new GameEngine(
    1000 / 30,
    () => {},
    () => renders++,
  );
  engine.start();
  for (let t = frameMs; t <= totalMs; t += frameMs) frame(t);
  return renders;
}

test("on a 120 Hz screen the engine draws at most 60 frames a second", () => {
  const renders = runEngine(1000 / 120, 1000);
  assert.ok(renders >= 58 && renders <= 61, `${renders} frames in a second`);
});

test("on a 60 Hz screen the engine draws every frame", () => {
  const renders = runEngine(1000 / 60, 1000);
  assert.ok(renders >= 59, `${renders} frames in a second`);
});

// ------------------------------------------------------------- pause

test("while paused, the frame on screen is drawn once, not on every refresh", () => {
  const still = new StillFrame();
  assert.equal(still.shouldDraw(true), true, "the paused frame");
  assert.equal(still.shouldDraw(true), false);
  assert.equal(still.shouldDraw(true), false);
});

test("a resize while paused draws the frame again (resizing clears the canvas)", () => {
  const still = new StillFrame();
  still.shouldDraw(true);
  still.invalidate();
  assert.equal(still.shouldDraw(true), true);
  assert.equal(still.shouldDraw(true), false);
});

test("playing draws every frame, and pausing again draws the paused frame once", () => {
  const still = new StillFrame();
  still.shouldDraw(true);
  assert.equal(still.shouldDraw(false), true);
  assert.equal(still.shouldDraw(false), true);
  assert.equal(still.shouldDraw(true), true);
  assert.equal(still.shouldDraw(true), false);
});
