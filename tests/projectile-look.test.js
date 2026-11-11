import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { SPIT_COLORS } from "../app/game/projectile-look";

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("the chameleon's sand spit is drawn in sand tones, not green acid", () => {
  for (const colour of [SPIT_COLORS.body, SPIT_COLORS.glint, SPIT_COLORS.trail]) {
    const hex = colour.startsWith("#") ? colour : null;
    assert.ok(hex, "a hex colour");
    const [r, g, b] = rgb(hex);
    // tan or yellow: red leads, green close behind, blue clearly lowest; never green-led
    assert.ok(r >= g && g > b && r - b >= 40, `${colour} is sand`);
  }
});
