import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { settings } from "../app/util/settings";

test("Show ghost is on by default and can be turned off", () => {
  localStorage.removeItem("settings");
  assert.equal(settings.get("ghost"), true);
  settings.set("ghost", false);
  assert.equal(settings.get("ghost"), false);
  settings.set("ghost", true);
  assert.equal(settings.get("ghost"), true);
  localStorage.removeItem("settings");
});
