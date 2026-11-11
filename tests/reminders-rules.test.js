import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REMINDER_HOUR,
  MAX_DEVICES,
  SETTINGS_LIMIT,
  TITLE,
  localTime,
  validTimeZone,
  reminderFor,
  isDue,
} from "../app/reminders/rules";

const root = process.cwd();
const at = (iso) => Date.parse(iso);

test("constants", () => {
  assert.equal(REMINDER_HOUR, 18);
  assert.equal(MAX_DEVICES, 5);
  assert.equal(SETTINGS_LIMIT, 30);
  assert.equal(TITLE, "Dino's Adventure");
});

test("localTime gives the local date seed and hour", () => {
  assert.deepEqual(localTime(at("2026-11-11T12:30:00Z"), "Asia/Kolkata"), {
    seed: 20261111,
    hour: 18,
  });
  assert.deepEqual(localTime(at("2026-11-11T12:30:00Z"), "America/Los_Angeles"), {
    seed: 20261111,
    hour: 4,
  });
  assert.equal(localTime(at("2026-11-11T23:30:00Z"), "Pacific/Kiritimati").seed, 20261112);
});

test("localTime follows daylight saving", () => {
  assert.equal(localTime(at("2026-10-31T22:00:00Z"), "America/New_York").hour, 18);
  assert.equal(localTime(at("2026-11-01T23:00:00Z"), "America/New_York").hour, 18);
});

test("midnight is hour 0, not 24", () => {
  assert.equal(localTime(at("2026-11-11T00:00:00Z"), "UTC").hour, 0);
});

test("unknown zones and non-strings are rejected", () => {
  for (const zone of ["Mars/Olympus", "", 42, null, undefined, {}, ["UTC"]]) {
    assert.equal(validTimeZone(zone), false, String(zone));
    assert.equal(localTime(Date.now(), zone), null, String(zone));
  }
  assert.equal(validTimeZone("Asia/Kolkata"), true);
  assert.equal(localTime(NaN, "UTC"), null);
});

test("a live streak gets the streak reminder", () => {
  assert.deepEqual(reminderFor({ days: 6, freezes: 0, last: 20261110 }, 20261111), {
    kind: "streak",
    title: "Dino's Adventure",
    body: "Your 6-day streak ends tonight. Play today's challenge to keep it.",
    days: 6,
  });
});

test("a freeze keeps a streak alive after one missed day", () => {
  assert.equal(reminderFor({ days: 6, freezes: 1, last: 20261109 }, 20261111).kind, "streak");
  assert.equal(reminderFor({ days: 6, freezes: 0, last: 20261109 }, 20261111).kind, "daily");
});

test("a streak missed for longer is dead", () => {
  assert.equal(reminderFor({ days: 6, freezes: 3, last: 20261108 }, 20261111).kind, "daily");
});

test("a 1-day streak gets the daily reminder", () => {
  assert.deepEqual(reminderFor({ days: 1, freezes: 0, last: 20261110 }, 20261111), {
    kind: "daily",
    title: "Dino's Adventure",
    body: "Today's challenge is up. 5 new levels are waiting.",
  });
});

test("having played today means no reminder", () => {
  assert.equal(reminderFor({ days: 6, freezes: 0, last: 20261111 }, 20261111), null);
});

test("no streak gets the daily reminder", () => {
  assert.equal(reminderFor(null, 20261111).kind, "daily");
});

test("a streak across a month end counts the last day as yesterday", () => {
  assert.equal(reminderFor({ days: 4, freezes: 0, last: 20261130 }, 20261201).kind, "streak");
});

test("a malformed streak falls back to the daily reminder", () => {
  for (const streak of [
    {},
    { days: "x", freezes: 0, last: 20261110 },
    { days: 5, freezes: 0, last: 99999999 },
  ]) {
    assert.equal(reminderFor(streak, 20261111).kind, "daily");
  }
});

test("isDue at 18:00 local once a day", () => {
  const noon = at("2026-11-11T12:30:00Z");
  assert.equal(isDue({ timeZone: "Asia/Kolkata", lastSentDay: null }, noon), true);
  assert.equal(isDue({ timeZone: "Asia/Kolkata", lastSentDay: 20261111 }, noon), false);
  assert.equal(isDue({ timeZone: "Asia/Kolkata", lastSentDay: 20261110 }, noon), true);
  assert.equal(
    isDue({ timeZone: "Asia/Kolkata", lastSentDay: null }, at("2026-11-11T13:30:00Z")),
    false,
  );
  assert.equal(isDue({ timeZone: "Mars/Olympus", lastSentDay: null }, noon), false);
});

test("the shared copy matches app/reminders/rules.js and loads in Node", () => {
  // Compares the one file instead of running the script: tests/daily-rules.test.js
  // edits app/daily/rules.js while it runs, and a parallel check would trip on it.
  const sync = fs.readFileSync(path.join(root, "scripts", "sync-functions-shared.js"), "utf8");
  assert.match(sync, /\["reminders\/rules\.js", "reminders\/rules\.js"\]/);
  const source = fs.readFileSync(path.join(root, "app", "reminders", "rules.js"), "utf8");
  const shared = path.join(root, "functions", "shared", "reminders", "rules.js");
  assert.equal(
    fs.readFileSync(shared, "utf8"),
    `// GENERATED from app/reminders/rules.js by scripts/sync-functions-shared.js. Do not edit.\n${source}`,
  );
  const load = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import(${JSON.stringify(shared)}).then((m) => console.log(typeof m.isDue))`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(load.stdout.trim(), "function", load.stderr);
});

test("firestore.rules closes pushSubs to clients", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  assert.match(rules, /match \/pushSubs\/\{uid\} \{\s*allow read, write: if false;\s*\}/);
});

test("validTimeZone refuses long or unknown names without keeping them", () => {
  assert.equal(validTimeZone("x".repeat(65)), false);
  assert.equal(validTimeZone(`Asia/${"K".repeat(200000)}`), false);
  assert.equal(validTimeZone("Not/AZone"), false);
  // a refused name is asked again, not answered from a cache
  assert.equal(validTimeZone("Not/AZone"), false);
  assert.equal(validTimeZone("America/Argentina/ComodRivadavia"), true);
});
