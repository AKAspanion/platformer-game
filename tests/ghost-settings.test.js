import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { settings } from "../app/util/settings";

test("Show ghost is off by default, can be turned on and stays on after a reload", () => {
  localStorage.removeItem("settings");
  assert.equal(settings.get("ghost"), false);
  assert.equal(settings.get("shake"), true);
  settings.set("ghost", true);
  assert.equal(settings.get("ghost"), true); // read back from storage
  settings.set("ghost", false);
  assert.equal(settings.get("ghost"), false);
  localStorage.removeItem("settings");
});
