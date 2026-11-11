import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { publishThumb } from "../app/worlds/thumb";

/** A scratch canvas whose PNG is `bytes` long. */
function scratch(bytes) {
  const calls = [];
  const out = {
    width: 0,
    height: 0,
    getContext: () => ({
      set imageSmoothingEnabled(value) {
        calls.push(["smoothing", value]);
      },
      drawImage: (...args) => calls.push(["draw", ...args.slice(1)]),
    }),
    toDataURL: (type) => {
      calls.push(["png", type]);
      return `data:image/png;base64,${Buffer.alloc(bytes, 7).toString("base64")}`;
    },
  };
  return { out, calls };
}

test("a 40 KB preview becomes base64 of a 480x270 PNG", () => {
  const { out, calls } = scratch(40 * 1024);
  const source = {};
  const result = publishThumb(source, () => out);
  assert.equal(Buffer.from(result, "base64").length, 40 * 1024);
  assert.equal(out.width, 480);
  assert.equal(out.height, 270);
  assert.deepEqual(
    calls.find((c) => c[0] === "draw"),
    ["draw", 0, 0, 480, 270],
  );
  assert.deepEqual(
    calls.find((c) => c[0] === "png"),
    ["png", "image/png"],
  );
});

test("a PNG over 102,400 bytes gives null", () => {
  assert.equal(
    publishThumb({}, () => scratch(102401).out),
    null,
  );
});

test("a PNG of exactly 102,400 bytes is kept", () => {
  assert.ok(publishThumb({}, () => scratch(102400).out));
});

test("a canvas that can't be drawn gives null", () => {
  const broken = { getContext: () => null };
  assert.equal(
    publishThumb({}, () => broken),
    null,
  );
});
