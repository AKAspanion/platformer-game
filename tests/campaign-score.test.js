/**
 * app/campaign/score-rules.js: the server's copy of each campaign level's
 * contents must match the levels the game plays.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import { LEVELS } from "../app/util";
import {
  CAMPAIGN_LEVELS,
  isCampaignLevel,
  levelScoreCeiling,
  campaignScore,
  BOSS_SCORE,
} from "../app/campaign/score-rules.js";
import { COMBO_MAX } from "../app/daily/rules.js";

const contents = (area) => ({
  coins: (area.coins || []).length,
  enemies: (area.enemies || []).length,
  powerups: (area.powerups || []).length,
  boss: !!area.boss,
});

test("CAMPAIGN_LEVELS lists every campaign level with its real contents", () => {
  const wanted = Object.fromEntries(LEVELS.map(({ id }) => [id, contents(areas[id])]));
  assert.deepEqual(
    CAMPAIGN_LEVELS,
    wanted,
    `update CAMPAIGN_LEVELS in app/campaign/score-rules.js to:\n${JSON.stringify(wanted)}`,
  );
});

test("only campaign levels rank, and a boss arena gives room for the boss", () => {
  assert.equal(isCampaignLevel(1), true);
  assert.equal(isCampaignLevel(5), false); // a passage between levels
  assert.equal(isCampaignLevel("1"), false);
  assert.equal(levelScoreCeiling(5), 0);
  assert.ok(levelScoreCeiling(25) >= COMBO_MAX * BOSS_SCORE);
});

test("campaignScore caps the score and refuses what can't be a run", () => {
  assert.equal(campaignScore({ level: 1, score: 120, seconds: 30 }), 120);
  assert.equal(campaignScore({ level: 1, score: 1e9, seconds: 30 }), levelScoreCeiling(1));
  assert.equal(campaignScore({ level: 1, score: 120, seconds: 1 }), null);
  assert.equal(campaignScore({ level: 1, score: -3, seconds: 30 }), null);
  assert.equal(campaignScore({ level: 6, score: 3, seconds: 30 }), null);
});
