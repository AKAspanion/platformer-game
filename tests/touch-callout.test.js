import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of every top-level rule whose selector list includes `selector`. */
const rulesFor = (selector) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((s) => s.trim() === selector))
    .map(([, , body]) => body)
    .join(";");

// On iPhone a long press on the game canvas (a thumb drifting off a touch button)
// or on an image opens the "Save Image" sheet and cancels the touch, so a held
// button lets go. The callout is turned off for the page, the canvas and images.
for (const selector of ["body", "canvas", "img"]) {
  test(`a long press on ${selector} opens no iOS image menu`, () => {
    assert.match(rulesFor(selector), /-webkit-touch-callout:\s*none/);
  });
}

test("the touch buttons opt out of the iOS long-press menu too", () => {
  assert.match(rulesFor(".controller-btn"), /-webkit-touch-callout:\s*none/);
  assert.match(rulesFor(".controller-btn"), /-webkit-user-select:\s*none/);
});
