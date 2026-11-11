/**
 * The boss shield's telegraph, drawn with plain canvas calls (alpha, fills, strokes):
 * a browser that ignores `ctx.filter` still shows the 0.5 s glow in full.
 */
import { SHIELD_GLOW } from "./boss";

/** Is the sprite on a bright frame of the glow's flicker? */
export function glowFlickers(boss) {
  return boss.shield === "glow" && boss.shieldTimer % 4 < 2;
}

/** The glow before the shield rises: a bright wash on flicker frames and a ring that grows. */
export function drawShieldGlow(ctx, boss, cx, cy) {
  if (boss.shield !== "glow") return;
  const progress = 1 - boss.shieldTimer / SHIELD_GLOW; // 0 at the first glow tick, then up to 1
  const radius = Math.max(boss.width, boss.height) * (0.6 + progress * 0.15);
  ctx.save();
  if (glowFlickers(boss)) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#e8f6ff";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.5 + progress * 0.4;
  ctx.strokeStyle = "#bfe8ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
