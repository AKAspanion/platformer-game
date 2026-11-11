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

test("every companion sprite is drawn at a whole-number scale of its pixels", () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png"));
  assert.equal(files.length, 16);
  files.forEach((file) => {
    const [w, h] = pngSize(path.join(DIR, file));
    const sx = COMPANION_SIZE.width / w;
    const sy = COMPANION_SIZE.height / h;
    assert.equal(sx, sy, `${file}: same scale on both axes`);
    assert.ok(Number.isInteger(sx) && sx >= 1, `${file}: drawn at ${sx}x`);
  });
});

test("the game draws companions with COMPANION_SIZE, in the level and in the shop preview", () => {
  const source = fs.readFileSync(path.join("app", "index.js"), "utf8");
  assert.equal(source.match(/COMPANION_SIZE/g).length >= 4, true);
  assert.doesNotMatch(source, /COMPANION_WIDTH|COMPANION_HEIGHT|, 24, 21\)/);
});
