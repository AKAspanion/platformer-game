import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createEarnings } from "../app/progress/earn";

const level = (id, totalCoins, totalEnemies = 0) => ({ id, totalCoins, totalEnemies });

test("coins are counted since the last tick: 0, 3, 5 gives 3 then 2", () => {
  const earn = createEarnings();
  assert.deepEqual(earn.tick(level(1, 0)), { coins: 0, kills: 0 });
  assert.equal(earn.tick(level(1, 3)).coins, 3);
  assert.equal(earn.tick(level(1, 5)).coins, 2);
  assert.equal(earn.tick(level(1, 5)).coins, 0);
});

test("kills are counted since the last tick", () => {
  const earn = createEarnings();
  earn.tick(level(1, 0, 0));
  assert.equal(earn.tick(level(1, 0, 2)).kills, 2);
  assert.equal(earn.tick(level(1, 0, 2)).kills, 0);
});

test("a new level starts from the world's own count, never repeating coins", () => {
  const earn = createEarnings();
  earn.tick(level(1, 0));
  earn.tick(level(1, 5, 2));
  // the run's counters carry into the next level: nothing is paid twice
  assert.deepEqual(earn.tick(level(2, 5, 2)), { coins: 0, kills: 0 });
  assert.equal(earn.tick(level(2, 6, 2)).coins, 1);
});

test("a reset world (retry or death) counts from its lower count, never negative", () => {
  const earn = createEarnings();
  earn.tick(level(1, 0));
  earn.tick(level(1, 5, 3));
  assert.deepEqual(earn.tick(level(1, 0, 0)), { coins: 0, kills: 0 });
  assert.deepEqual(earn.tick(level(1, 2, 1)), { coins: 2, kills: 1 });
});

test("the first tick of a session pays nothing for what the world already holds", () => {
  const earn = createEarnings();
  assert.deepEqual(earn.tick(level(7, 4, 1)), { coins: 0, kills: 0 });
});

test("junk counts give nothing", () => {
  const earn = createEarnings();
  earn.tick(level(1, 1));
  assert.deepEqual(earn.tick({ id: 1, totalCoins: NaN, totalEnemies: undefined }), {
    coins: 0,
    kills: 0,
  });
});
