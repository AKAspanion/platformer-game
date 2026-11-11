import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { SHIELD_GLOW } from "../app/game/boss";
import { drawShieldGlow, glowFlickers } from "../app/game/shield-fx";

/** A canvas that records what is drawn, and the alpha it was drawn at. */
function recorder() {
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fillRect() {},
    fill() {
      calls.push({ op: "fill", alpha: this.globalAlpha, style: this.fillStyle });
    },
    stroke() {
      calls.push({ op: "stroke", alpha: this.globalAlpha, style: this.strokeStyle });
    },
  };
  // setting ctx.filter would be a sign the telegraph needs it
  Object.defineProperty(ctx, "filter", {
    set() {
      throw new Error("the glow must not use ctx.filter");
    },
  });
  return { ctx, calls };
}

const boss = (shieldTimer, shield = "glow") => ({ shield, shieldTimer, width: 40, height: 40 });

test("the glow's first tick already draws a clearly visible ring, without ctx.filter", () => {
  const { ctx, calls } = recorder();
  drawShieldGlow(ctx, boss(SHIELD_GLOW), 100, 100);
  const rings = calls.filter((c) => c.op === "stroke");
  assert.ok(rings.length > 0, "a ring is stroked");
  assert.ok(
    rings.every((r) => r.alpha >= 0.4),
    `ring alpha ${rings.map((r) => r.alpha)}`,
  );
});

test("the ring stays visible and grows stronger through the 15 glow ticks", () => {
  let last = 0;
  for (let timer = SHIELD_GLOW; timer >= 1; timer--) {
    const { ctx, calls } = recorder();
    drawShieldGlow(ctx, boss(timer), 0, 0);
    const alpha = Math.max(...calls.filter((c) => c.op === "stroke").map((c) => c.alpha));
    assert.ok(alpha >= 0.4 && alpha >= last, `tick ${timer}: ${alpha}`);
    last = alpha;
  }
});

test("flicker frames add a bright wash that is visible without ctx.filter", () => {
  let washes = 0;
  for (let timer = SHIELD_GLOW; timer >= 1; timer--) {
    const { ctx, calls } = recorder();
    const flickers = glowFlickers(boss(timer));
    drawShieldGlow(ctx, boss(timer), 0, 0);
    const wash = calls.filter((c) => c.op === "fill" && c.alpha >= 0.25);
    assert.equal(wash.length > 0, flickers, `tick ${timer}`);
    if (flickers) washes++;
  }
  assert.ok(washes > 3 && washes < SHIELD_GLOW, "it flickers, on and off");
});

test("nothing is drawn when the boss is not glowing", () => {
  for (const shield of ["none", "up", "cooldown"]) {
    const { ctx, calls } = recorder();
    drawShieldGlow(ctx, boss(5, shield), 0, 0);
    assert.equal(calls.length, 0, shield);
    assert.equal(glowFlickers(boss(0, shield)), false);
  }
});

test("the shell's boss drawing does not set ctx.filter", async () => {
  const { readFileSync } = await import("node:fs");
  assert.doesNotMatch(readFileSync("app/index.js", "utf8"), /ctx\.filter/);
});
