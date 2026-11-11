/**
 * firestore.rules can't import the shop catalogue, so the players/{uid} match
 * holds each slot's item IDs as a literal list. This keeps those lists equal to
 * PROFILE_IDS, so a new item can't ship without the rules allowing it. The
 * rules' behaviour is tested against the emulator in tests/rules/players.test.js.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROFILE_IDS, PROFILE_SLOTS } from "../app/profiles/rules";

const rules = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");
const block = rules.match(/match \/players\/\{uid\} \{([\s\S]*?)\n    \}/);

test("firestore.rules has a players/{uid} match", () => {
  assert.ok(block, "a players/{uid} match exists");
});

for (const slot of PROFILE_SLOTS) {
  test(`firestore.rules: the ${slot} list equals PROFILE_IDS.${slot}`, () => {
    const pattern = new RegExp(`request\\.resource\\.data\\.${slot} in \\[([^\\]]*)\\]`, "g");
    assert.ok(block, "a players/{uid} match exists");
    const lists = [...block[1].matchAll(pattern)];
    assert.equal(lists.length, 1, `one literal list for ${slot}`);
    const ids = [...lists[0][1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    assert.deepEqual(ids, PROFILE_IDS[slot]);
  });
}

test("firestore.rules: the catch-all still comes after players/{uid}", () => {
  const players = rules.indexOf("match /players/{uid}");
  const catchAll = rules.indexOf("match /{document=**}");
  assert.ok(players > 0);
  assert.ok(catchAll > players);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
