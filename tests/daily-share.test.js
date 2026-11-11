import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { shareText, shareRun } from "../app/daily/share";

const run = {
  seed: 20261111,
  levels: ["clean", "clean", "hurt", "lost", "unreached"],
  score: 4320,
  seconds: 221,
  rank: 12,
  total: 340,
  streak: 6,
};

test("shareText matches the spec example", () => {
  assert.equal(
    shareText(run),
    [
      "Dino's Adventure Daily · 11 Nov 2026",
      "🟩🟩🟨🟥⬛",
      "Score 4,320 · 3:41 · #12 of 340",
      "🔥 6-day streak",
      "https://dino.spanion.in",
    ].join("\n"),
  );
});

test("an unranked run leaves the rank out", () => {
  const lines = shareText({ ...run, rank: undefined, total: undefined }).split("\n");
  assert.equal(lines[2], "Score 4,320 · 3:41");
});

test("a streak under 2 days leaves the streak line out", () => {
  for (const streak of [0, 1]) {
    const text = shareText({ ...run, streak });
    assert.ok(!text.includes("streak"));
    assert.equal(text.split("\n").length, 4);
  }
});

test("seconds format as m:ss and long times keep the minutes", () => {
  assert.ok(shareText({ ...run, seconds: 65 }).includes("1:05"));
  assert.ok(shareText({ ...run, seconds: 3725 }).includes("62:05"));
});

test("small scores and other months format", () => {
  const text = shareText({ ...run, seed: 20270105, score: 950 });
  assert.ok(text.startsWith("Dino's Adventure Daily · 5 Jan 2027"));
  assert.ok(text.includes("Score 950 ·"));
  assert.ok(shareText({ ...run, score: 1234567 }).includes("1,234,567"));
});

test("shareRun uses the share sheet", async () => {
  const calls = [];
  const nav = { share: async (data) => calls.push(data) };
  assert.equal(await shareRun("hi", nav), "share");
  assert.deepEqual(calls, [{ text: "hi" }]);
});

test("a dismissed share sheet fails without copying", async () => {
  let copied = false;
  const nav = {
    share: () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })),
    clipboard: {
      writeText: async () => {
        copied = true;
      },
    },
  };
  assert.equal(await shareRun("hi", nav), "failed");
  assert.equal(copied, false);
});

test("without a share sheet it copies to the clipboard", async () => {
  let text = null;
  const nav = {
    clipboard: {
      writeText: async (t) => {
        text = t;
      },
    },
  };
  assert.equal(await shareRun("hi", nav), "copy");
  assert.equal(text, "hi");
});

test("a failing clipboard gives failed, and a missing one too", async () => {
  const nav = { clipboard: { writeText: () => Promise.reject(new Error("no")) } };
  assert.equal(await shareRun("hi", nav), "failed");
  assert.equal(await shareRun("hi", {}), "failed");
});

test("a share sheet error other than a dismissal falls back to copy", async () => {
  const nav = {
    share: () => Promise.reject(new Error("boom")),
    clipboard: { writeText: async () => {} },
  };
  assert.equal(await shareRun("hi", nav), "copy");
});
