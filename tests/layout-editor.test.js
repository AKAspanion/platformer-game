import test from "node:test";
import assert from "node:assert/strict";
import { createLayoutEditor } from "../app/controller/layout-editor";
import { CONTROL_IDS } from "../app/controller/layout";

const DEFAULTS = {
  leftBtn: { x: 0.1, y: 0.9 },
  rightBtn: { x: 0.2, y: 0.9 },
  fireBtn: { x: 0.8, y: 0.9 },
  jumpBtn: { x: 0.9, y: 0.88 },
  pauseBtn: { x: 0.5, y: 0.93 },
};

/** An editor that records what it saved. */
const make = (initial = null) => {
  const calls = { saved: [], cancelled: 0 };
  const editor = createLayoutEditor({
    initial,
    defaults: () => DEFAULTS,
    onSave: (layout) => calls.saved.push(layout),
    onCancel: () => calls.cancelled++,
  });
  return { editor, calls };
};

test("with no saved layout the editor starts at the default places, all five controls", () => {
  const { editor } = make();
  assert.deepEqual(Object.keys(editor.positions), CONTROL_IDS);
  assert.deepEqual(editor.positions, DEFAULTS);
  assert.equal(editor.open, true);
});

test("a saved layout is where the editor starts; the other controls start at their default", () => {
  const { editor } = make({ fireBtn: { x: 0.4, y: 0.4 } });
  assert.deepEqual(editor.positions.fireBtn, { x: 0.4, y: 0.4 });
  assert.deepEqual(editor.positions.leftBtn, DEFAULTS.leftBtn);
});

test("moving one control never moves another", () => {
  const { editor } = make();
  editor.move("fireBtn", { x: 0.3, y: 0.3 });
  assert.deepEqual(editor.positions.fireBtn, { x: 0.3, y: 0.3 });
  for (const id of CONTROL_IDS.filter((i) => i !== "fireBtn")) {
    assert.deepEqual(editor.positions[id], DEFAULTS[id]);
  }
});

test("a move of an unknown control or a bad place is ignored", () => {
  const { editor } = make();
  editor.move("ghostBtn", { x: 0.3, y: 0.3 });
  editor.move("fireBtn", { x: NaN, y: 0.3 });
  editor.move("fireBtn", { x: 2, y: 0.3 });
  assert.deepEqual(editor.positions, DEFAULTS);
  assert.deepEqual(Object.keys(editor.positions), CONTROL_IDS);
});

test("Save stores all five places and closes", () => {
  const { editor, calls } = make();
  editor.move("jumpBtn", { x: 0.7, y: 0.5 });
  editor.save();
  assert.equal(calls.saved.length, 1);
  assert.deepEqual(calls.saved[0], { ...DEFAULTS, jumpBtn: { x: 0.7, y: 0.5 } });
  assert.equal(editor.open, false);
  assert.equal(calls.cancelled, 0);
});

test("Save with nothing moved keeps the default: it stores null", () => {
  const { editor, calls } = make();
  editor.save();
  assert.deepEqual(calls.saved, [null]);
});

test("Save with nothing moved keeps a layout that was already saved", () => {
  const saved = { ...DEFAULTS, fireBtn: { x: 0.4, y: 0.4 } };
  const { editor, calls } = make(saved);
  editor.save();
  assert.deepEqual(calls.saved, [saved]);
});

test("Reset puts every control back at its default place, and Save then stores null", () => {
  const { editor, calls } = make({ ...DEFAULTS, fireBtn: { x: 0.4, y: 0.4 } });
  editor.move("leftBtn", { x: 0.6, y: 0.2 });
  editor.reset();
  assert.deepEqual(editor.positions, DEFAULTS);
  editor.save();
  assert.deepEqual(calls.saved, [null]);
});

test("moving a control after Reset stores a layout again", () => {
  const { editor, calls } = make();
  editor.reset();
  editor.move("pauseBtn", { x: 0.5, y: 0.1 });
  editor.save();
  assert.deepEqual(calls.saved, [{ ...DEFAULTS, pauseBtn: { x: 0.5, y: 0.1 } }]);
});

test("Cancel closes and changes nothing", () => {
  const { editor, calls } = make();
  editor.move("fireBtn", { x: 0.3, y: 0.3 });
  editor.cancel();
  assert.equal(editor.open, false);
  assert.deepEqual(calls.saved, []);
  assert.equal(calls.cancelled, 1);
});

test("a closed editor ignores moves, Reset, Save and Cancel", () => {
  const { editor, calls } = make();
  editor.cancel();
  editor.move("fireBtn", { x: 0.3, y: 0.3 });
  editor.reset();
  editor.save();
  editor.cancel();
  assert.deepEqual(calls.saved, []);
  assert.equal(calls.cancelled, 1);
});
