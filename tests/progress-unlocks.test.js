import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  SECRET_STARS,
  campaignStars,
  secretWorldOpen,
  bossesBeaten,
  bossRushOpen,
} from "../app/progress/unlocks";
import { LEVELS } from "../app/util/index";

const campaign = (stars = {}, best = {}) => ({ reached: [1], last: 1, stars, best });
const bossIds = LEVELS.filter((l) => l.boss).map((l) => l.id);

/** A campaign holding exactly `n` stars: full levels first, then a partial one. */
function withStars(n) {
  const stars = {};
  LEVELS.forEach((level, i) => {
    const here = Math.max(0, Math.min(3, n - i * 3));
    stars[level.id] = [0, 1, 3, 7][here];
  });
  return campaign(stars);
}

test("the secret world needs 75 of the 90 stars", () => {
  assert.equal(SECRET_STARS, 75);
  assert.equal(campaignStars(withStars(74)), 74);
  assert.equal(secretWorldOpen(withStars(74)), false);
  assert.equal(campaignStars(withStars(75)), 75);
  assert.equal(secretWorldOpen(withStars(75)), true);
  assert.equal(campaignStars(withStars(90)), 90);
});

test("stars on unknown levels do not count, and an empty campaign has none", () => {
  assert.equal(campaignStars(campaign({ 999: 7 })), 0);
  assert.equal(campaignStars(campaign()), 0);
  assert.equal(campaignStars(undefined), 0);
  assert.equal(secretWorldOpen(campaign()), false);
});

test("the levels list has the five boss levels", () => {
  assert.equal(bossIds.length, 5);
  assert.ok(bossIds.includes(25) && bossIds.includes(27));
});

test("boss rush opens once all five bosses have a best time", () => {
  const best = {};
  bossIds.slice(0, 4).forEach((id) => (best[id] = 42));
  assert.equal(bossesBeaten(campaign({}, best)), 4);
  assert.equal(bossRushOpen(campaign({}, best)), false);
  best[bossIds[4]] = 50;
  assert.equal(bossesBeaten(campaign({}, best)), 5);
  assert.equal(bossRushOpen(campaign({}, best)), true);
});

test("best times of ordinary levels are not bosses", () => {
  const best = { 1: 10, 2: 11, 7: 12 };
  assert.equal(bossesBeaten(campaign({}, best)), 0);
  assert.equal(bossRushOpen(campaign({}, best)), false);
  assert.equal(bossRushOpen(undefined), false);
});

test("with no boss levels boss rush stays closed", () => {
  assert.equal(bossRushOpen(campaign(), [{ id: 1 }]), false);
});
