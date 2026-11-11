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
  ".like-btn", // the heart on a world card
  ".text-input", // #worldSearch and the other text fields
];

// drawn small on a short screen; an invisible ::after keeps the 44 px touch area
const SMALL_WITH_HIT_AREA = TAP_TARGETS.filter((t) => ![".setting-row", ".text-input"].includes(t));

/** The compact block's rules whose selector list holds `selector`. */
const rulesFor = (block, selector) =>
  [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((s) => s.trim() === selector))
    .map(([, , body]) => body);

test("on a short screen buttons are drawn small: no min-height of 44 px or more", () => {
  const block = compactBlock();
  for (const selector of SMALL_WITH_HIT_AREA) {
    assert.ok(minHeightOf(block, selector) < 44, `${selector} is drawn smaller than 44 px`);
  }
});

test("on a short screen every small button keeps an invisible 44 px touch area", () => {
  const block = compactBlock();
  for (const selector of SMALL_WITH_HIT_AREA) {
    const own = rulesFor(block, selector).join(";");
    assert.match(own, /position:\s*relative/, `${selector} is the touch area's anchor`);
    const hit = rulesFor(block, `${selector}::after`).join(";");
    assert.match(hit, /content:\s*""/, `${selector}::after exists`);
    assert.match(hit, /position:\s*absolute/, `${selector}::after is laid over the button`);
    assert.match(hit, /min-height:\s*44px|height:\s*44px/, `${selector}::after is 44 px tall`);
  }
});

test("rows and text fields stay easy to tap without an overlay over their controls", () => {
  const block = compactBlock();
  assert.ok(minHeightOf(block, ".setting-row") >= 40, "a Settings row is at least 40 px");
  assert.ok(minHeightOf(block, ".text-input") >= 38, "a text field is at least 38 px");
  assert.equal(rulesFor(block, ".setting-row::after").length, 0, "no overlay over a row's switch");
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
