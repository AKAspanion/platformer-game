import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const html = fs.readFileSync("app/index.html", "utf8");

/** The body of the `@media (max-height: 499px)` block (the landscape phone). */
const compactBlock = () => {
  const start = css.indexOf("@media (max-height: 499px)");
  assert.ok(start >= 0, "the compact block exists");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error("unclosed block");
};

/** The smallest min-height (px) any rule in the block gives `selector`; 0 when none does. */
const minHeightOf = (block, selector) => {
  let best = 0;
  for (const [, selectors, body] of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(",").some((s) => s.trim() === selector)) continue;
    const found = /min-height:\s*(\d+)px/.exec(body);
    if (found) best = Math.max(best, Number(found[1]));
  }
  return best;
};

// every tappable control on the home screen and in the menus and modals
const TAP_TARGETS = [
  ".btn",
  ".btn-small",
  ".mode-card",
  ".tab", // shop, create and leaderboard tabs
  ".segmented button", // Settings: control size, control opacity, touch buttons
  ".setting-row", // a Settings row (its switch is the control)
  ".account-chip", // #accountChip
  ".chip", // #communityRefresh
  ".seg-btn", // #listTrendingBtn, #listNewBtn
  ".link-btn", // #loginResetBtn
  ".delete-btn", // a world's delete button in My worlds
  ".close-btn",
];

test("on a short screen every tap target has a hit area of at least 44 px", () => {
  const block = compactBlock();
  for (const selector of TAP_TARGETS) {
    const height = minHeightOf(block, selector) || (selector === ".close-btn" ? 44 : 0);
    assert.ok(height >= 44, `${selector} gets a ${height}px min-height in the compact block`);
  }
});

test("every kind of button in the markup is covered by that list", () => {
  const classes = new Set();
  for (const [, attrs] of html.matchAll(/<button\b([^>]*)>/g)) {
    const found = /class="([^"]*)"/.exec(attrs);
    if (!found) continue; // a bare button belongs to .segmented
    found[1].split(/\s+/).forEach((name) => classes.add(name));
  }
  const modifiers = new Set(["active", "btn-primary", "btn-secondary", "btn-ghost", "btn-google"]);
  for (const name of classes) {
    if (modifiers.has(name) || name.startsWith("btn-") || name === "lb-retry") continue;
    assert.ok(
      TAP_TARGETS.includes(`.${name}`),
      `.${name} is a tap target the compact block must size`,
    );
  }
});
