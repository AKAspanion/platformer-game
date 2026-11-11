import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COMPANION_SIZE } from "../app/game/companion";

const DIR = path.join("app", "assets", "sprites", "companions");

/** [width, height] of a PNG, from its header. */
const pngSize = (file) => {
  const head = fs.readFileSync(file);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
};

// scripts/generate-sprites.py draws each companion on a 16 x 14 grid and saves it 2x
const ART = { width: 16, height: 14 };
const SAVE_SCALE = 2;

test("every companion is drawn at its 16 x 14 art size: one art pixel per game pixel", () => {
  assert.deepEqual(COMPANION_SIZE, ART, "small beside the dino");
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png"));
  assert.equal(files.length, 16);
  files.forEach((file) => {
    const [w, h] = pngSize(path.join(DIR, file));
    assert.equal(w, ART.width * SAVE_SCALE, `${file}: the art saved at 2x`);
    assert.equal(h, ART.height * SAVE_SCALE, `${file}: the art saved at 2x`);
  });
});

test("the game draws companions with COMPANION_SIZE, in the level and in the shop preview", () => {
  const source = fs.readFileSync(path.join("app", "index.js"), "utf8");
  assert.equal(source.match(/COMPANION_SIZE/g).length >= 4, true);
  assert.doesNotMatch(source, /COMPANION_WIDTH|COMPANION_HEIGHT|, 24, 21\)/);
});

test("?companion=<id> on a test host wears that companion for the session, saving nothing", () => {
  const source = fs.readFileSync(path.join("app", "index.js"), "utf8");
  const pick = /const testCompanion = ([\s\S]*?)\}\)\(\);/.exec(source);
  assert.ok(pick, "a testCompanion is worked out once");
  assert.match(pick[1], /canToggleLocally\(\)/, "test hosts only, never the live site");
  assert.match(pick[1], /COMPANION_IDS\.includes\(/, "only a real companion id");
  assert.match(pick[1], /get\("companion"\)/, "from the ?companion= parameter");
  assert.match(
    source,
    /wornCompanion = testCompanion \|\| wallet\.worn\(\)\.companion \|\| "none"/,
  );
  assert.doesNotMatch(
    source,
    /testCompanion[^\n]*(wallet\.(wear|grant|buy)|settings\.set)/,
    "nothing is saved",
  );
});
