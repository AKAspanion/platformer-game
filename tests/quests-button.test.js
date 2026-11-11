import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createQuests, questsLabel, localDay, weekStart } from "../app/rewards/quests";

const html = fs.readFileSync("app/index.html", "utf8");
const js = fs.readFileSync("app/index.js", "utf8");
const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const memoryStorage = () => {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
};
const ctx = () => ({
  unlocked: ["story", "daily", "endless", "community"],
  metEnemies: ["pig", "slime"],
});
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0);
const pick = (id, tier, target) => ({ id, tier, target, coins: 50, text: id, stat: "kill" });
const stored = (day, picks, progress) =>
  JSON.stringify({ day, picks, progress, week: weekStart(day), weekDone: [], played: {} });

test("remaining() counts today's quests not finished: 3, 2, 1, 0", () => {
  const storage = memoryStorage();
  const clock = at(2026, 11, 11);
  const day = localDay(clock);
  const picks = [pick("a", 0, 5), pick("b", 1, 5), pick("c", 2, 5)];
  const quests = createQuests(storage, () => clock, ctx);
  storage.setItem("quests", stored(day, picks, [0, 0, 0]));
  assert.equal(quests.remaining(), 3);
  storage.setItem("quests", stored(day, picks, [5, 0, 0]));
  assert.equal(quests.remaining(), 2);
  storage.setItem("quests", stored(day, picks, [5, 5, 2]));
  assert.equal(quests.remaining(), 1);
  storage.setItem("quests", stored(day, picks, [5, 5, 5]));
  assert.equal(quests.remaining(), 0);
});

test("remaining() is 3 again after local midnight brings new quests", () => {
  const storage = memoryStorage();
  let clock = at(2026, 11, 11, 23);
  const day = localDay(clock);
  const picks = [pick("a", 0, 1), pick("b", 1, 1), pick("c", 2, 1)];
  storage.setItem("quests", stored(day, picks, [1, 1, 1]));
  const quests = createQuests(storage, () => clock, ctx);
  assert.equal(quests.remaining(), 0);
  clock = at(2026, 11, 12, 0);
  assert.equal(quests.remaining(), 3);
});

test("the button's label carries the count, and is plain with none left", () => {
  assert.equal(questsLabel(3), "Quests, 3 to do");
  assert.equal(questsLabel(2), "Quests, 2 to do");
  assert.equal(questsLabel(1), "Quests, 1 to do");
  assert.equal(questsLabel(0), "Quests");
});

test("#questsBtn sits right after #leaderboardsBtn in the footer icon row", () => {
  const row = /<div class="icon-row">([\s\S]*?)<\/div>\s*<\/div>/.exec(html)[1];
  const ids = [...row.matchAll(/<div id="(\w+)"/g)].map((m) => m[1]);
  assert.equal(ids[ids.indexOf("leaderboardsBtn") + 1], "questsBtn");
  assert.match(html, /<div id="questsBtn" role="button" aria-label="Quests">/);
  assert.match(html, /id="questsBadge"/);
});

test("the cards are in the Quests modal, not on the home screen", () => {
  const home = html.slice(html.indexOf('id="homeScreen"'), html.indexOf('id="pauseScreen"'));
  assert.doesNotMatch(home, /id="questCard"|id="nestCard"/);
  const from = html.indexOf('id="questsScreen"');
  assert.ok(from > 0, "the modal exists");
  const modal = html.slice(from, html.indexOf('id="settingsScreen"'));
  assert.match(modal, /<div class="modal-title">Quests<\/div>/);
  assert.match(modal, /id="questsCloseBtn" class="close-btn" role="button" aria-label="Close"/);
  for (const id of ["questCard", "questList", "questKeys", "nestCard", "nestList"]) {
    assert.match(modal, new RegExp(`id="${id}"`), id);
  }
});

test("the home screen keeps the hatch card", () => {
  assert.match(html, /id="hatchScreen"/);
});

test("the icon uses quests_btn.webp at the footer icon size, with a badge", () => {
  assert.match(css, /#questsBtn\s*\{[^}]*url\(images\/quests_btn\.webp\)/);
  assert.match(css, /#leaderboardsBtn,\s*#questsBtn,\s*#settingsBtn,\s*#helpBtn,\s*#infoBtn\s*\{/);
  assert.ok(fs.existsSync("app/images/quests_btn.webp"));
  assert.match(fs.readFileSync("scripts/generate-icons.py", "utf8"), /"quests": quests/);
  assert.match(css, /\.badge\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.badge\[hidden\]\s*\{\s*display:\s*none/);
});

test("the badge and label update on home refresh and when the panel closes", () => {
  assert.match(js, /questsLabel\(left\)/);
  const refresh = js.slice(js.indexOf("const refreshHome = () => {"));
  assert.match(refresh.slice(0, 500), /renderQuestsBadge\(\)/);
  assert.match(js, /\$\("questsBtn"\)\.onclick/);
  assert.match(js, /\$\("questsCloseBtn"\)\.onclick = \(\) => \{[^}]*renderQuestsBadge\(\)/);
});

test("the landscape home no longer reserves a column for the cards", () => {
  assert.doesNotMatch(css, /\.home-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.doesNotMatch(
    html.slice(html.indexOf('id="homeScreen"'), html.indexOf('id="pauseScreen"')),
    /home-cards/,
  );
});

test("the Quests panel sits above the home screen, like the Leaderboards panel", () => {
  const rule = css.match(/([^{}]*)\{\s*z-index:\s*13;\s*\}/);
  assert.ok(rule, "a z-index: 13 rule exists");
  const selectors = rule[1].split(",").map((s) => s.trim());
  assert.ok(selectors.includes("#leaderboardScreen"));
  assert.ok(selectors.includes("#questsScreen"));
});
