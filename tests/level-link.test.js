import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { levelFromQuery } from "../app/util/level-link";
import { LEVELS } from "../app/util";

const named = (search) => levelFromQuery(search, LEVELS)?.name ?? null;

test("?level= takes an area id, which is the level's place in the campaign", () => {
  assert.equal(named("?level=1"), "Grassland 1");
  assert.equal(named("?level=3"), "Grassland 3");
  assert.equal(named("?level=9"), "Iceland 3");
  assert.equal(named("?level=30"), "Factory 6");
  assert.equal(named("?debug&level=6"), "Grassland 6");
});

test("?level= takes a level's name, written any common way", () => {
  ["iceland-3", "Iceland 3", "ICELAND_3", "iceland%203", " iceland-3 "].forEach((v) =>
    assert.equal(named(`?level=${v}`), "Iceland 3", v),
  );
  assert.equal(named("?level=graveyard-6"), "Graveyard 6");
});

test("no ?level=, or one naming no level, opens nothing", () => {
  [
    "",
    "?debug",
    "?level=",
    "?level=0",
    "?level=31",
    "?level=iceland-7",
    "?level=9.5",
    "?level=-1",
  ].forEach((search) => assert.equal(named(search), null, search));
});

test("the game only reads ?level= on test hosts", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/index.js"), "utf8");
  assert.match(
    source,
    /canToggleLocally\(\) \? new URLSearchParams\(location\.search\)\.get\("level"\)/,
  );
});
