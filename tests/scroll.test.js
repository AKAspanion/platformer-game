import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import { joinsSeamlessly, createSlide, SLIDE_TICKS } from "../app/engine/scroll";

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
