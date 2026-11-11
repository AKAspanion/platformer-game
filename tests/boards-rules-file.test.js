/**
 * firestore.rules as text (pnpm test, no emulator): the boards are closed to
 * clients (spec 4.4), and every rule that lets a client in is pinned, so a
 * change that opens anything else fails here. tests/rules/boards.test.js
 * checks the same against the emulator.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rules = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");
// comments out: they describe the rules, they aren't rules
const code = rules.replace(/\/\/[^\n]*/g, "");

/** The text of `match <header> { ... }` (balanced braces). */
function block(header) {
  const start = code.indexOf(`match ${header} {`);
  assert.ok(start >= 0, `missing match ${header}`);
  let depth = 0;
  for (let i = start + `match ${header} `.length; i < code.length; i++) {
    if (code[i] === "{") depth++;
    if (code[i] === "}" && --depth === 0) return code.slice(start, i + 1);
  }
  throw new Error("unbalanced");
}

for (const header of ["/daily/{seed}/scores/{uid}", "/endless/{uid}"]) {
  test(`firestore.rules: ${header} allows no client read, list or write`, () => {
    const text = block(header);
    const allows = [...text.matchAll(/allow ([^:]+):\s*if ([^;]+);/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(allows, [
      ["read", "false"],
      ["write", "false"],
    ]);
  });
}

test("firestore.rules: the boards' matches come before the catch-all", () => {
  const catchAll = code.indexOf("match /{document=**}");
  assert.ok(code.indexOf("match /daily/{seed}/scores/{uid}") < catchAll);
  assert.ok(code.indexOf("match /endless/{uid}") < catchAll);
});

/**
 * Every `allow` whose condition isn't `false`, as "<operations>: <condition>"
 * (whitespace collapsed). The boards' public reads are gone; nothing else changed.
 */
test("firestore.rules: every rule that lets a client in is one of these", () => {
  const open = [...code.matchAll(/allow ([^:]+):\s*if ([^;]+);/g)]
    .map((m) => [m[1].trim(), m[2].replace(/\s+/g, " ").trim()])
    .filter(([, condition]) => condition !== "false")
    .map(([operations, condition]) => `${operations}: ${condition.slice(0, 60)}`);
  assert.deepEqual(open, [
    // worlds
    "get: true",
    "list: request.query.limit <= 100",
    // saves
    "read: request.auth != null && request.auth.uid == uid",
    "create, update: request.auth != null && request.auth.uid == uid && request.r",
    // worldStats and its days
    "get: true",
    "list: request.query.limit <= 100",
    "get: true",
    "list: request.query.limit <= 100",
    // worldLikes, own only
    "get: request.auth != null && id.matches('.*_' + request.auth.uid)",
    // config
    "get: true",
    // players, own writes only
    "create, update: request.auth != null && request.auth.uid == uid && request.r",
  ]);
});
