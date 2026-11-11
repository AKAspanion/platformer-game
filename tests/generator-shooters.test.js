import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ARRIVALS,
  SHOOT_MIN,
  SHOOT_MAX,
  SHOOT_HEIGHT,
  SHOOT_EVERY,
  LEVELS,
  TILE,
  WALKERS,
  generateSequence,
  generateEndlessLevel,
  walkerShoots,
  storyDifficulty,
} from "../app/pcg/generator";
import { dailyLevels } from "../app/daily/rules";

const WALKER_WIDTH = { pig: 21, slime: 23, chameleon: 22, beetle: 20 };

// the centre of a walker standing at `left` tiles, as the generator measures it
const centre = (left) => left * TILE + 10;

test("the shooting constants", () => {
  assert.equal(SHOOT_MIN, 52);
  assert.equal(SHOOT_MAX, 120);
  assert.equal(SHOOT_HEIGHT, 24);
  assert.equal(SHOOT_EVERY, 90);
  assert.deepEqual(ARRIVALS, [16, 330]);
});

test("walkers never shoot below difficulty 2", () => {
  for (let left = 0; left <= 21; left += 0.5) assert.equal(walkerShoots(left, 1), false);
  assert.equal(walkerShoots(10, 0), false);
});

test("a walker shoots only more than SHOOT_MAX px from both arrival spots", () => {
  // 10 px is the half-width the rule assumes, so the centre is left * 16 + 10
  const far = (left) => Math.min(...ARRIVALS.map((x) => Math.abs(centre(left) - x)));
  // left 9 -> centre 154: 138 from 16 and 176 from 330: shoots
  assert.equal(walkerShoots(9, 2), true);
  // near the left portal and the right portal: never
  assert.equal(walkerShoots(2, 5), false);
  assert.equal(walkerShoots(19, 5), false);
  // exactly 120 px is still in range; the next step out is not
  for (let left = 0; left <= 21; left += 0.25) {
    assert.equal(walkerShoots(left, 3), far(left) > SHOOT_MAX, `left ${left}`);
  }
  // 121 px from both spots (a centre at 137 is 121 from 16, 193 from 330)
  assert.equal(walkerShoots((137 - 10) / TILE, 2), true);
  assert.equal(walkerShoots((136 - 10) / TILE, 2), false);
  assert.equal(walkerShoots((16 + 120 - 10) / TILE, 2), false);
});

test("storyDifficulty reads LEVELS, and is 1 for a hand-made level", () => {
  for (const level of LEVELS) assert.equal(storyDifficulty(level.id), level.difficulty);
  assert.equal(storyDifficulty(1), 1);
  assert.equal(storyDifficulty(99999), 1);
});

const DAILY_SEEDS = Array.from({ length: 200 }, (_, i) => 20260101 + i);
const ENDLESS_SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 37);

function dailyAreas(seed) {
  return generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) });
}
function endlessAreas(seed) {
  const out = [];
  let prevExit = 9;
  for (let index = 0; index < 6; index++) {
    const { data, exit } = generateEndlessLevel({
      id: 4000 + index,
      seed: seed + index * 7919,
      index,
      prevExit,
    });
    prevExit = exit;
    out.push(data);
  }
  return out;
}

const difficultyOf = (areas, i, kind) =>
  kind === "daily" ? 1 + i : Math.min(5, 1 + Math.floor(i / 2));

function everyArea(fn) {
  DAILY_SEEDS.forEach((seed) =>
    dailyAreas(seed).forEach((area, i) => fn(area, difficultyOf(null, i, "daily"))),
  );
  ENDLESS_SEEDS.forEach((seed) =>
    endlessAreas(seed).forEach((area, i) => fn(area, difficultyOf(null, i, "endless"))),
  );
}

test("every shooting walker passes walkerShoots; no spitter or flyer shoots", () => {
  let shooters = 0;
  let walkers = 0;
  everyArea((area, difficulty) => {
    area.enemies.forEach((enemy) => {
      if (!WALKERS.includes(enemy.type)) {
        assert.equal(enemy.shoots, undefined, `${enemy.id} (${enemy.type}) must not shoot`);
        return;
      }
      walkers++;
      assert.ok(WALKER_WIDTH[enemy.type]);
      if (enemy.shoots) {
        shooters++;
        assert.equal(enemy.shoots, true);
        assert.ok(walkerShoots(enemy.left, difficulty), `${enemy.id} at ${enemy.left}`);
      } else {
        assert.equal(enemy.shoots, undefined);
        assert.equal(walkerShoots(enemy.left, difficulty), false, `${enemy.id} at ${enemy.left}`);
      }
    });
  });
  assert.ok(walkers > 0 && shooters > 0, `${shooters} of ${walkers} walkers shoot`);
});

test("shooting is a flag only: the levels are the ones generated before it existed", () => {
  // a digest of 200 daily and 200 endless seeds' levels, taken before `shoots` existed
  const hash = createHash("sha256");
  everyArea((area) => {
    const plain = {
      ...area,
      enemies: area.enemies.map(({ shoots, ...enemy }) => enemy),
    };
    hash.update(JSON.stringify(plain));
  });
  assert.equal(
    hash.digest("hex"),
    "6f5335aae85c084b7b60e8998a39b6ffaff86fb3a04d97eef35f86ba209465b0",
  );
});

test("the combat sounds exist and each is under a second long", () => {
  const names = [
    ...Array.from({ length: 8 }, (_, i) => `combo-${i + 1}`),
    "combo-chime",
    "shield-up",
    "shield-clang",
    "mud-throw",
    "glob-throw",
    "spit-throw",
    "pebble-throw",
  ];
  assert.equal(names.length, 15);
  names.forEach((name) => {
    const wav = fs.readFileSync(path.join(process.cwd(), "app/assets/audio/sfx", `${name}.wav`));
    // a 16-bit mono PCM wav: the data chunk's byte count over the byte rate
    const seconds = wav.readUInt32LE(40) / wav.readUInt32LE(28);
    assert.ok(seconds > 0.02 && seconds < 1, `${name} is ${seconds}s`);
  });
});
