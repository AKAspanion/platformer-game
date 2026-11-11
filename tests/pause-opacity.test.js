import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const shell = fs.readFileSync("app/index.js", "utf8");

/** The rule that wins for `selector`: the last one in the file. */
const ruleFor = (selector) => {
  let found = null;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(",").some((s) => s.trim() === selector)) found = body;
  }
  return found;
};

test("the shell marks a device without touch on the page", () => {
  assert.match(
    shell,
    /classList\.toggle\(\s*"no-touch",\s*!isTouchesEnabled\s*\)/,
    "no-touch follows isTouchesEnabled",
  );
});

test("pause is full opacity without touch, and follows Control opacity with touch", () => {
  const plain = ruleFor("#pauseBtn");
  assert.match(plain, /opacity:\s*var\(--ctrl-idle,\s*0\.45\)/, "touch devices: Control opacity");
  const desktop = ruleFor(".no-touch #pauseBtn");
  assert.ok(desktop, "a rule for the pause button on a device without touch");
  assert.match(desktop, /opacity:\s*1\b/);
  const desktopPressed = ruleFor(".no-touch #pauseBtn:active");
  assert.ok(desktopPressed && /opacity:\s*1\b/.test(desktopPressed), "stays opaque while pressed");
});

test("the pause button keeps its bottom-middle place everywhere", () => {
  const place = ruleFor(".persistent-controller");
  assert.match(place, /left:\s*50%/);
  assert.match(place, /bottom:\s*calc\(var\(--sab\)/);
  assert.doesNotMatch(ruleFor(".no-touch #pauseBtn") || "", /left|bottom|top|right|position/);
});

test("the pause button keeps its original 40 px size, and the hint clears it", () => {
  const root = ruleFor(":root");
  assert.match(root, /--pause-size:\s*40px/);
  const plain = ruleFor("#pauseBtn");
  assert.match(plain, /width:\s*var\(--pause-size\)/);
  assert.match(plain, /height:\s*var\(--pause-size\)/);
  assert.match(plain, /\/\s*var\(--pause-size\)\s*no-repeat/);
  const hintBottoms = [...css.matchAll(/(^|\})\s*\.hint\s*\{([^{}]*)\}/g)]
    .map((m) => m[2])
    .filter((body) => /bottom:/.test(body));
  assert.ok(hintBottoms.length > 0, "a .hint rule places it");
  for (const body of hintBottoms) assert.match(body, /bottom:[^;]*var\(--pause-size\)/);
});
