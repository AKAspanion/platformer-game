import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { controlOpacity } from "../app/controller/opacity";
import { settings } from "../app/util/settings";
import { helpItemsFor } from "../app/util";

test("with no saved setting, control opacity is medium", () => {
  assert.deepEqual(controlOpacity(settings.get("controlOpacity")), { idle: 0.45, pressed: 0.75 });
});

test("low, medium and high map to their idle and pressed opacity", () => {
  assert.deepEqual(controlOpacity("low"), { idle: 0.25, pressed: 0.55 });
  assert.deepEqual(controlOpacity("medium"), { idle: 0.45, pressed: 0.75 });
  assert.deepEqual(controlOpacity("high"), { idle: 0.7, pressed: 1 });
});

test("an unknown control opacity falls back to medium", () => {
  assert.deepEqual(controlOpacity("loud"), { idle: 0.45, pressed: 0.75 });
  assert.deepEqual(controlOpacity(undefined), { idle: 0.45, pressed: 0.75 });
});

test("Help shows only the touch controls on a touch device", () => {
  assert.deepEqual(
    helpItemsFor(true).map((s) => s.name),
    ["Mobile"],
  );
});

test("Help shows only the keyboard controls everywhere else", () => {
  assert.deepEqual(
    helpItemsFor(false).map((s) => s.name),
    ["Desktop"],
  );
});
