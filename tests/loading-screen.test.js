import test from "node:test";
import assert from "node:assert/strict";
import { loadingScreenUp } from "../app/util/loading-screen";

// Endless waits for a run ticket from the server before it loads its first level.
// The level on the canvas meanwhile is the old one, frozen: the loading screen has to
// stay over it, or the game looks stuck on the last level.
test("while a mode is starting, the loading screen stays up over the old, loaded level", () => {
  assert.equal(loadingScreenUp({ levelLoaded: true, modeStarting: true }), true);
});

test("a level still loading keeps the loading screen up", () => {
  assert.equal(loadingScreenUp({ levelLoaded: false, modeStarting: false }), true);
});

test("once the new level has loaded and nothing is starting, the loading screen comes down", () => {
  assert.equal(loadingScreenUp({ levelLoaded: true, modeStarting: false }), false);
});
