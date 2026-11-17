import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import World from "../app/game/world";
import { joinsSeamlessly, runInto } from "../app/engine/scroll";
import { TILE, generateEndlessLevel, generateSequence } from "../app/pcg/generator";
import { buildWorld } from "../app/gen";
import { dailyLevels } from "../app/daily/rules";

/**
 * The levels made at play time (community worlds created from a prompt, the daily's
 * five, endless) keep to the scrolling world's rules like the story's: every floor is
 * a drawn ledge, every seam walks on with no wall or hidden pit, and no walk or jump
 * (dirt is background) ever drops the dino into a pit hidden in the dirt.
 */
const reef = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/sunny-coral-reef.json"), "utf8"),
);

/** A created world like reef, with its seed, difficulty and kind of pit. */
const created = (seed, difficulty, pits) => {
  const world = {
    ...reef,
    id: `test-${seed}-${difficulty}-${pits}`,
    seed,
    spec: { ...reef.spec, difficulty, terrain: { ...reef.spec.terrain, pits } },
  };
  const assets = buildWorld(world, { audio: false });
  const chain = generateSequence({ idBase: 9000, seed: assets.seed, levels: assets.levels });
  chain.forEach((data) => (data.skin = assets.key)); // as createCustomSession does
  return chain;
};

const endless = (seed, count) => {
  const chain = [];
  let prevExit = 9;
  for (let index = 0; index < count; index++) {
    const { data, exit } = generateEndlessLevel({
      id: 2000 + index,
      seed: seed + index * 7919,
      index,
      prevExit,
    });
    chain.push(data);
    prevExit = exit;
  }
  return chain;
};

const RUNS = [
  ["created, liquid pits", created(889198317, 3, "liquid")],
  ["created, spike pits", created(11, 5, "spikes")],
  ["created, open pits", created(222, 1, "void")],
  [
    "daily 20261111",
    generateSequence({ idBase: 3000, seed: 20261111, levels: dailyLevels(20261111) }),
  ],
  [
    "daily 20270101",
    generateSequence({ idBase: 3000, seed: 20270101, levels: dailyLevels(20270101) }),
  ],
  ["endless 42", endless(42, 9)],
];

const TOPS = new Set([1, 2, 3, 12, 13, 14, 15]); // tile ids drawn as a ledge's top

test("every floor in a generated level is the top of a drawn ledge", () => {
  const problems = [];
  RUNS.forEach(([name, chain]) =>
    chain.forEach((area) =>
      area.collisonMap.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (c >= area.columns || r >= area.rows - 1 || !String(cell).includes("t")) return;
          const ids = [area.areaMap[r][c]].flat();
          if (!ids.some((t) => TOPS.has(t))) problems.push(`${name}: ${area.id} r${r}c${c}`);
        }),
      ),
    ),
  );
  assert.deepEqual(problems, []);
});

test("every floor at a generated seam walks on into the next level: no wall, no hidden pit", () => {
  const problems = [];
  let seams = 0;
  RUNS.forEach(([name, chain]) => {
    const byId = Object.fromEntries(chain.map((a) => [a.id, a]));
    chain.forEach((from) => {
      const portal = from.portals.find((p) => p.direction === 1 && p.destinationArea != null);
      const to = portal && byId[portal.destinationArea];
      if (!joinsSeamlessly(from, to, portal)) return;
      seams += 1;
      const seam = from.columns * TILE;
      for (let row = 1; row < from.rows; row++) {
        for (const dir of [1, -1]) {
          const area = dir > 0 ? from : to;
          const column = dir > 0 ? from.columns - 1 : 0;
          const cell = (r) => String(area.collisonMap[r][column] || "");
          if (!cell(row).includes("t") || cell(row - 1).includes("t")) continue;
          const world = new World();
          world.reset();
          world.setup(from);
          world.extend(to);
          world.enemies.items = [];
          const { player } = world;
          player.x = player.xOld = seam + dir * -12 - player.width / 2;
          player.y = player.yOld = row * TILE - player.height - 0.01;
          for (let i = 0; i < 20; i++) {
            if (dir > 0) player.moveRight();
            else player.moveLeft();
            world.update(() => {});
          }
          const crossed = dir > 0 ? player.getLeft() > seam + 8 : player.getRight() < seam - 8;
          if (!crossed || world.respawns) {
            problems.push(`${name}: ${from.id}|${to.id} row ${row} ${dir > 0 ? "right" : "left"}`);
          }
        }
      }
    });
  });
  assert.ok(seams >= 15, `${seams} seams`);
  assert.deepEqual(problems, []);
});

test("no walk or jump in a generated run drops the dino into a pit hidden in the dirt", () => {
  const problems = new Set();
  RUNS.forEach(([name, chain]) => {
    const byId = Object.fromEntries(chain.map((a) => [a.id, a]));
    chain
      .filter((area) => !area.boss)
      .forEach((area) => {
        const world = new World();
        world.reset();
        world.setupRun(runInto(byId, area.id));
        const { player } = world;
        const first = world.segment.x / TILE;
        for (let r = 1; r < world.rows; r++) {
          for (let c = first; c < first + area.columns; c++) {
            const here = String(world.collisonMap[r][c] || "");
            if (!here.includes("t") || String(world.collisonMap[r - 1][c] || "") !== "") continue;
            // walk, full jump and a jump let go at once, both ways, running
            for (const dir of [1, -1]) {
              for (const release of [-1, 99, 1]) {
                player.reset();
                Object.assign(world, { isPlayerDead: false, respawns: 0, lastSafe: null });
                world.enemies.items = [];
                world.spawn = { x: c * TILE, y: r * TILE - player.height - 0.01 };
                player.x = player.xOld = c * TILE + 8 - player.width / 2;
                player.y = player.yOld = r * TILE - player.height - 0.01;
                player.velocityX = dir * 3;
                if (release >= 0) player.jump();
                for (let i = 0; i < 45 && !world.respawns; i++) {
                  if (i === release) player.releaseJump();
                  if (dir > 0) player.moveRight();
                  else player.moveLeft();
                  const x = player.getCenterX();
                  world.update(() => {});
                  if (!world.respawns) continue;
                  // into a pit: fine where one is (a pit zone), not down through drawn dirt
                  const column = Math.floor(x / TILE);
                  const pit = world.deathAreas.some((d) => x >= d.x - 4 && x <= d.x + d.width + 4);
                  if (!pit && world.drawnAt(world.rows - 1, column)) {
                    problems.add(`${name}: area ${world.segmentAt(x).id} column ${column}`);
                  }
                }
              }
            }
          }
        }
      });
  });
  assert.deepEqual([...problems], []);
});
