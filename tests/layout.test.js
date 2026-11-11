import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CONTROL_IDS,
  DEFAULT_LAYOUT,
  normalizeLayout,
  clampToScreen,
  toFractions,
} from "../app/controller/layout";
import { settings } from "../app/util/settings";
import { emptyProgress, readLocal, writeLocal } from "../app/progress/save";

const VIEW = { width: 667, height: 375 };
const INSET = { top: 0, right: 44, bottom: 21, left: 44 };
const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
};

const inside = ({ left, top }, size, view, inset) =>
  left >= inset.left &&
  top >= inset.top &&
  left + size <= view.width - inset.right &&
  top + size <= view.height - inset.bottom;

test("the five controls and a default of null (the CSS default)", () => {
  assert.deepEqual(CONTROL_IDS, ["leftBtn", "rightBtn", "fireBtn", "jumpBtn", "pauseBtn"]);
  assert.equal(DEFAULT_LAYOUT, null);
});

test("normalizeLayout keeps known ids with x and y in 0..1", () => {
  const raw = { leftBtn: { x: 0.1, y: 0.9 }, pauseBtn: { x: 0.5, y: 0 }, fireBtn: { x: 1, y: 1 } };
  assert.deepEqual(normalizeLayout(raw), raw);
});

test("normalizeLayout drops unknown ids and out-of-range or malformed values", () => {
  const out = normalizeLayout({
    leftBtn: { x: 0.2, y: 0.8, extra: 1 },
    ghostBtn: { x: 0.5, y: 0.5 },
    rightBtn: { x: 1.2, y: 0.5 },
    fireBtn: { x: 0.5, y: -0.1 },
    jumpBtn: { x: "0.5", y: 0.5 },
    pauseBtn: { x: NaN, y: 0.5 },
  });
  assert.deepEqual(out, { leftBtn: { x: 0.2, y: 0.8 } });
});

test("normalizeLayout returns null when nothing is valid", () => {
  for (const raw of [null, undefined, 7, "x", [], {}, { ghostBtn: { x: 0.1, y: 0.1 } }]) {
    assert.equal(normalizeLayout(raw), null);
  }
});

test("clampToScreen puts a control centred on x and y when it fits", () => {
  const at = clampToScreen({ x: 0.5, y: 0.5 }, 64, VIEW, NO_INSET);
  assert.deepEqual(at, { left: 667 / 2 - 32, top: 375 / 2 - 32 });
});

test("clampToScreen keeps a 64 px control fully on screen, inside the safe area, for any input", () => {
  for (const x of [-0.3, 0, 0.01, 0.5, 0.99, 1, 1.2, 5, -Infinity, NaN]) {
    for (const y of [-0.3, 0, 0.5, 1, 1.2, Infinity, NaN]) {
      const at = clampToScreen({ x, y }, 64, VIEW, INSET);
      assert.ok(inside(at, 64, VIEW, INSET), `x=${x} y=${y} -> ${JSON.stringify(at)}`);
    }
  }
});

test("clampToScreen takes a control's width and height separately", () => {
  const at = clampToScreen({ x: 1.2, y: 1.2 }, { width: 80, height: 80 }, VIEW, NO_INSET);
  assert.deepEqual(at, { left: 667 - 80, top: 375 - 80 });
});

test("toFractions gives the centre of the control as shares of the viewport", () => {
  assert.deepEqual(toFractions(100, 50, 64, VIEW), { x: 132 / 667, y: 82 / 375 });
});

test("toFractions(clamp(...)) round-trips to the same place", () => {
  for (const spot of [
    { x: 0.2, y: 0.7 },
    { x: -0.3, y: 1.4 },
    { x: 1.2, y: -0.2 },
  ]) {
    const first = clampToScreen(spot, 64, VIEW, INSET);
    const again = clampToScreen(toFractions(first.left, first.top, 64, VIEW), 64, VIEW, INSET);
    assert.ok(Math.abs(again.left - first.left) < 1e-9);
    assert.ok(Math.abs(again.top - first.top) < 1e-9);
  }
});

test("after a rotation (width and height swapped) every control is still on screen", () => {
  const layout = normalizeLayout({
    leftBtn: { x: 0.05, y: 0.95 },
    rightBtn: { x: 0.2, y: 0.95 },
    fireBtn: { x: 0.8, y: 0.9 },
    jumpBtn: { x: 0.95, y: 0.95 },
    pauseBtn: { x: 0.5, y: 0.97 },
  });
  const turned = { width: VIEW.height, height: VIEW.width };
  const inset = { top: 21, right: 0, bottom: 34, left: 0 };
  for (const view of [VIEW, turned, { width: 320, height: 180 }]) {
    for (const id of CONTROL_IDS) {
      const at = clampToScreen(layout[id], 64, view, inset);
      assert.ok(inside(at, 64, view, inset), `${id} in ${view.width}x${view.height}`);
    }
  }
});

test("with no saved layout the setting is null, so the CSS default stays", () => {
  assert.equal(settings.get("controlLayout"), null);
  assert.equal(normalizeLayout(settings.get("controlLayout")), null);
});

test("a saved layout survives a settings reload", () => {
  const layout = { leftBtn: { x: 0.1, y: 0.8 }, pauseBtn: { x: 0.5, y: 0.1 } };
  settings.set("controlLayout", layout);
  assert.match(localStorage.getItem("settings"), /controlLayout/);
  assert.deepEqual(normalizeLayout(settings.get("controlLayout")), layout);
  settings.set("controlLayout", null);
  assert.equal(settings.get("controlLayout"), null);
});

test("cloud save does not carry the layout: it stays on this device", () => {
  settings.set("controlLayout", { leftBtn: { x: 0.1, y: 0.8 } });
  const storage = memoryStorage({
    settings: localStorage.getItem("settings"),
    campaign: JSON.stringify({ reached: [1, 2], last: 2, stars: {}, best: {} }),
  });
  const progress = readLocal(storage);
  assert.doesNotMatch(JSON.stringify(progress), /controlLayout|leftBtn/);
  assert.doesNotMatch(JSON.stringify(emptyProgress()), /controlLayout/);
  const target = memoryStorage();
  writeLocal(progress, target);
  assert.ok(!("settings" in target.data), "writing a save never writes the settings key");
  settings.set("controlLayout", null);
  const source = fs.readFileSync("app/progress/save.js", "utf8");
  assert.doesNotMatch(source, /controlLayout|"settings"/);
});
