import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import areas from "../app/areas";
import { joinsSeamlessly, createSlide, SLIDE_TICKS } from "../app/engine/scroll";
import { TILE, generateEndlessLevel, generateSequence } from "../app/pcg/generator";
import { buildWorld } from "../app/gen";
import { dailyLevels } from "../app/daily/rules";
import { createBossRushSession, BOSS_RUSH_BASE } from "../app/modes/bossrush";

const forward = (area) => area.portals.find((p) => p.direction > 0);
const backward = (area) => area.portals.find((p) => p.direction < 0);
const pans = (fromId, portalOf = forward) => {
  const from = areas[fromId];
  const portal = portalOf(from);
  return joinsSeamlessly(from, areas[portal.destinationArea], portal);
};

// ----------------------------------------------------------- which walks pan

test("the levels of a world join on, both ways", () => {
  // grasslands 1 → 2 → 7 → 9 → 10, then iceland 3 → 8 → 11 → 12 → 26
  [1, 2, 7, 9, 3, 8, 11, 12].forEach((id) => assert.equal(pans(id), true, `${id} forward`));
  [2, 7, 9, 10, 8, 11, 12, 26].forEach((id) =>
    assert.equal(pans(id, backward), true, `${id} back`),
  );
});

test("a boss arena stays its own room: walking in or out of it cuts", () => {
  assert.equal(pans(10), false, "into the King Pig");
  assert.equal(pans(25), false, "out of the King Pig");
  assert.equal(pans(3, backward), false, "back into the King Pig");
  [26, 28, 30, 32].forEach((id) => assert.equal(pans(id), false, `${id} into its boss`));
});

test("the whole campaign, walked through: it cuts only into and out of each world's boss", () => {
  const cuts = [];
  for (let id = 1; areas[id];) {
    const portal = forward(areas[id]);
    const next = portal.destinationArea;
    if (!pans(id)) cuts.push(`${id}->${next}`);
    if (!areas[next]) break; // the last boss's exit ends the campaign
    id = next;
  }
  assert.deepEqual(cuts, [
    "10->25", // King Pig
    "25->3",
    "26->27", // Frost Slime
    "27->13",
    "28->29", // Sand Lizard
    "29->17",
    "30->31", // Bat Lord
    "31->21",
    "32->33", // Mecha Beetle
    "33->-1",
  ]);
});

test("a change of world, look or screen size cuts", () => {
  const a = { world: 1, rows: 12, columns: 21, areaMap: [] };
  const portal = { direction: 1 };
  assert.equal(joinsSeamlessly(a, { ...a }, portal), true);
  assert.equal(joinsSeamlessly(a, { ...a, world: 2 }, portal), false);
  assert.equal(joinsSeamlessly(a, { ...a, skin: "neon" }, portal), false);
  assert.equal(joinsSeamlessly(a, { ...a, columns: 16 }, portal), false);
  assert.equal(joinsSeamlessly(a, undefined, portal), false);
  assert.equal(joinsSeamlessly(a, { ...a }, null), false);
});

// ------------------------------------------------------------------ the pan

test("walking right, the next level comes in from the right and ends square on screen", () => {
  const slide = createSlide({
    direction: 1,
    width: 336,
    from: { x: 320, y: 100 },
    to: { x: 4, y: 120 },
  });
  assert.deepEqual(slide.frame(0), { old: -0, next: 336 });
  for (let t = 0; t < SLIDE_TICKS; t++) {
    assert.equal(slide.done, false);
    slide.step();
  }
  assert.equal(slide.done, true);
  assert.deepEqual(slide.frame(0), { old: -336, next: 0 });
});

test("walking left, the next level comes in from the left", () => {
  const slide = createSlide({
    direction: -1,
    width: 336,
    from: { x: 2, y: 100 },
    to: { x: 320, y: 100 },
  });
  assert.deepEqual(slide.frame(0), { old: 0, next: -336 });
  for (let t = 0; t < SLIDE_TICKS; t++) slide.step();
  assert.deepEqual(slide.frame(0), { old: 336, next: 0 });
});

test("the dino crosses the seam without a jump: it starts where it walked out", () => {
  [
    { direction: 1, from: { x: 320, y: 100 }, to: { x: 4, y: 120 } },
    { direction: -1, from: { x: 2, y: 90 }, to: { x: 318, y: 136 } },
  ].forEach(({ direction, from, to }) => {
    const slide = createSlide({ direction, width: 336, from, to });
    const onScreen = () => {
      const at = slide.player(0);
      return { x: at.x + slide.frame(0).next, y: at.y };
    };
    assert.deepEqual(onScreen(), from, "first frame: where it walked out");
    let last = onScreen().x;
    for (let t = 0; t < SLIDE_TICKS; t++) {
      slide.step();
      const { x } = onScreen();
      // moves steadily one way, never doubling back
      assert.ok(
        direction > 0 ? x <= last + 1e-9 : x >= last - 1e-9,
        `tick ${t}: ${x} after ${last}`,
      );
      last = x;
    }
    assert.deepEqual(slide.player(0), to, "last frame: where the portal puts it");
  });
});

test("a frame between ticks is drawn part way along, never past the end", () => {
  const slide = createSlide({
    direction: 1,
    width: 100,
    from: { x: 90, y: 0 },
    to: { x: 4, y: 0 },
  });
  const a = slide.progress(0);
  const b = slide.progress(0.5);
  slide.step();
  assert.ok(a < b && b < slide.progress(0));
  for (let t = 0; t < SLIDE_TICKS + 5; t++) slide.step();
  assert.equal(slide.progress(0.9), 1);
});

// ------------------------------------------------------ generated levels

const reef = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/sunny-coral-reef.json"), "utf8"),
);

/** The top row of the ground (solid down to the bottom of the screen) in column `col`. */
const groundTop = (area, col) => {
  let row = area.areaMap.length;
  while (row > 0 && area.areaMap[row - 1][col]) row -= 1;
  return row;
};

/**
 * Walks a chain of generated areas the way a player does and checks every step:
 * it pans exactly when `shouldPan` says so, a pan lands on ground that runs on from
 * the level left (no step at the seam), and the dino arrives standing on it.
 */
function walkChain(chain, shouldPan, where) {
  const byId = Object.fromEntries(chain.map((a) => [a.id, a]));
  const kinds = [];
  chain.forEach((from) => {
    const portal = forward(from);
    const to = byId[portal.destinationArea];
    const pan = joinsSeamlessly(from, to, portal);
    kinds.push(pan ? "pan" : "cut");
    if (!to) return;
    assert.equal(pan, shouldPan(from, to), `${where}: ${from.id} -> ${to.id}`);
    const back = backward(to);
    assert.equal(joinsSeamlessly(to, from, back), pan, `${where}: ${to.id} back to ${from.id}`);
    if (!pan) return;
    const exitRow = groundTop(from, from.areaMap[0].length - 1);
    assert.equal(groundTop(to, 0), exitRow, `${where}: the ground steps at ${from.id} -> ${to.id}`);
    assert.equal(portal.destinationY, exitRow * TILE - 8, `${where}: arrives standing in ${to.id}`);
    assert.equal(back.destinationY, exitRow * TILE - 8, `${where}: back, standing in ${from.id}`);
  });
  return kinds;
}

const sameWorldNoBoss = (from, to) => !from.boss && !to.boss && from.world === to.world;

test("a created (AI-designed) world plays as one long level, then cuts to its boss", () => {
  const assets = buildWorld(reef, { audio: false });
  const chain = generateSequence({ idBase: 9000, seed: assets.seed, levels: assets.levels });
  chain.forEach((data) => (data.skin = assets.key)); // as createCustomSession does
  const kinds = walkChain(chain, sameWorldNoBoss, "reef");
  assert.deepEqual(kinds, ["pan", "pan", "pan", "pan", "cut", "cut"]);
});

test("a daily run is one look all the way: it pans level to level, then finishes", () => {
  [20261111, 20261112, 20261113, 20261114, 20261115, 20261231, 20270101].forEach((seed) => {
    const chain = generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) });
    const kinds = walkChain(chain, sameWorldNoBoss, `daily ${seed}`);
    assert.deepEqual(kinds, ["pan", "pan", "pan", "pan", "cut"], `daily ${seed}`);
  });
});

test("endless pans through each stretch of one look and cuts where the look changes", () => {
  [1, 42, 123456789].forEach((seed) => {
    const chain = [];
    let prevExit = 9;
    for (let index = 0; index < 16; index++) {
      const { data, exit } = generateEndlessLevel({
        id: 2000 + index,
        seed: seed + index * 7919,
        index,
        prevExit,
      });
      chain.push(data);
      prevExit = exit;
    }
    const kinds = walkChain(chain, sameWorldNoBoss, `endless ${seed}`);
    // a new look every 3 levels (themeFor); the last is the edge of what was generated
    assert.deepEqual(kinds.slice(0, 15), [
      ...["pan", "pan", "cut"],
      ...["pan", "pan", "cut"],
      ...["pan", "pan", "cut"],
      ...["pan", "pan", "cut"],
      ...["pan", "pan", "cut"],
    ]);
  });
});

test("boss rush is all boss arenas: every step cuts", () => {
  createBossRushSession();
  for (let id = BOSS_RUSH_BASE; areas[id]; id++) {
    const portal = forward(areas[id]);
    assert.equal(joinsSeamlessly(areas[id], areas[portal.destinationArea], portal), false, `${id}`);
  }
});
