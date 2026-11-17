import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import Game from "../app/game";
import { assetsOf } from "../app/game/world";
import { SEED_IMAGES } from "../app/game/projectiles";
import { enemyTypes } from "../app/game/enemies";

// A walker's shot (mud, glob, spit, pebble) is drawn with the seed sprites. A level
// whose only shooters are walkers must ask for them up front: asked for at the first
// shot, they put the loading screen back up in the middle of play.

const tick = () => new Promise((resolve) => setTimeout(resolve));
const noop = () => {};
const kindOf = (type) => enemyTypes[type] && enemyTypes[type].kind;

/** Story areas with no turret and no boss: only a walker can fire there. */
const walkerOnly = Object.values(areas).filter(
  (area) => !area.boss && !(area.enemies || []).some(({ type }) => kindOf(type) === "turret"),
);

/** Sets up `area` in a fresh game and lets its sprites and music arrive. */
const open = async (area) => {
  const game = new Game(noop);
  game.world.reset();
  game.world.setup(area);
  await tick();
  Object.values(globalThis.__audios).forEach((audio) => audio.fire("canplaythrough"));
  return game;
};

const shootingWalkerIn = (game) =>
  game.world.enemies.items.find((enemy) => enemy.shoots && !enemy.dying);

test("a level whose walkers shoot asks for the seed sprites up front", async () => {
  let checked = 0;
  for (const area of walkerOnly) {
    const game = await open(area);
    if (!shootingWalkerIn(game)) continue;
    checked += 1;
    const images = assetsOf(area).images;
    const missing = SEED_IMAGES.filter((src) => !images.includes(src));
    assert.deepEqual(missing, [], `area ${area.id} has shooting walkers but no seed sprites`);
  }
  assert.ok(checked > 0, "some story level has a walker that shoots and no turret or boss");
});

test("a walker's first shot does not put the loading screen back up", async () => {
  let game = null;
  let walker = null;
  for (const area of walkerOnly) {
    game = await open(area);
    walker = shootingWalkerIn(game);
    if (walker) break;
  }
  assert.ok(walker, "some story level has a walker that shoots and no turret or boss");
  assert.equal(game.isLoaded(), true, "level loaded");

  // the walker fires, as Enemies.update's spit callback does
  game.world.projectiles.add(walker.x, walker.y, 1, { kind: "mud", vx: 2.4 });
  assert.equal(game.isLoaded(), true, "still loaded after the first shot");
});
