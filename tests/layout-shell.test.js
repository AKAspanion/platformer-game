import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("app/index.html", "utf8");
const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const shell = fs.readFileSync("app/index.js", "utf8");
const ui = fs.readFileSync("app/controller/layout-ui.js", "utf8");
const input = fs.readFileSync("app/controller/mouse-input.js", "utf8");

const ruleFor = (selector) => {
  let found = null;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(",").some((s) => s.trim() === selector)) found = body;
  }
  return found;
};

test("Settings has a Customize layout button under Touch buttons, hidden without touch", () => {
  const touchRow = html.indexOf('id="setControls"');
  const row = html.indexOf('id="layoutRow"');
  assert.ok(row > touchRow && touchRow > 0, "the row follows the Touch buttons row");
  assert.match(html, /id="customizeLayoutBtn"[^>]*>\s*Customize layout\s*</);
  const hidden = ruleFor(".no-touch #layoutRow");
  assert.ok(hidden, "a rule hides the row on a device without touch");
  assert.match(hidden, /display:\s*none/);
});

test("the editor is a full-screen layer above the game and Settings, with the three buttons", () => {
  assert.match(html, /id="layoutEditor"/);
  assert.match(html, /Drag the buttons where you want them/);
  for (const [id, label] of [
    ["layoutSaveBtn", "Save"],
    ["layoutResetBtn", "Reset"],
    ["layoutCancelBtn", "Cancel"],
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*>\\s*${label}\\s*<`));
  }
  const layer = ruleFor("#layoutEditor");
  assert.match(layer, /position:\s*fixed/);
  assert.match(layer, /inset:\s*0/);
  const z = Number(/z-index:\s*(\d+)/.exec(layer)[1]);
  const settingsZ = 14; // the highest modal (#verifyScreen)
  assert.ok(z > settingsZ, `z-index ${z} is above the modals`);
});

test("the editor buttons are 44 px tap targets, top-centre", () => {
  const bar = ruleFor(".layout-bar");
  assert.match(bar, /top:/);
  assert.match(bar, /left:\s*50%/);
  assert.match(ruleFor(".layout-bar button"), /min-height:\s*44px/);
});

test("a dragged control follows pointer events, so touch and mouse both work", () => {
  assert.match(ui, /pointerdown/);
  assert.match(ui, /pointermove/);
  assert.match(ui, /pointerup/);
  assert.match(ruleFor(".layout-handle"), /touch-action:\s*none/);
});

test("a saved layout places each control with position: fixed, out of its flex row", () => {
  assert.match(ui, /position\s*=\s*"fixed"|position:\s*fixed/);
  assert.match(ui, /clampToScreen/);
  assert.match(
    ui,
    /parentElement\.style\.transform\s*=\s*place \? "none"/,
    "the centred pause holder",
  );
});

test("the shell applies the layout on start, on resize and on rotation, on touch devices only", () => {
  assert.match(shell, /settings\.get\("controlLayout"\)/);
  assert.match(shell, /applyControlLayout/);
  assert.match(
    shell,
    /isTouchesEnabled[^;]*applyControlLayout|applyControlLayout[\s\S]{0,80}isTouchesEnabled/,
  );
  const resize = /const resize = \(\) => \{[\s\S]*?\n {2}\};/.exec(shell)[0];
  assert.match(resize, /applyLayout\(\)/);
});

test("the touch buttons hit-test by their own element, so they work wherever they sit", () => {
  assert.match(input, /btn\.ontouchstart/);
  assert.doesNotMatch(input, /clientX|clientY|getBoundingClientRect/);
});

test("the open editor blocks the game's keys like any other menu", () => {
  assert.match(shell, /\$\("layoutEditor"\)/);
  const menu = /const isMenuOpen = [\s\S]*?\.some\(isVisible\)/.exec(shell)[0];
  assert.match(menu, /layoutEditor/);
});
