import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { friendlyError } from "../app/firebase/index";

const UNKNOWN = "Something went wrong. Try again.";

test("friendlyError turns every case into player copy", () => {
  const cases = [
    [{ code: "functions/internal", message: "internal" }, UNKNOWN],
    [{ message: "internal [0]" }, UNKNOWN],
    [
      { code: "functions/unavailable", message: "unavailable [503]" },
      "Can't reach the server right now.",
    ],
    [
      { code: "functions/invalid-argument", message: "That run can't be ranked. [400]" },
      "That run can't be ranked.",
    ],
    [new Error("Firebase: Error (auth/xyz)."), UNKNOWN],
    [null, UNKNOWN],
    ["oops", UNKNOWN],
  ];
  for (const [error, expected] of cases) {
    const result = friendlyError(error);
    assert.equal(result, expected);
    assert.doesNotMatch(result, /internal|\[|\//i);
  }
});

test("friendlyError keeps the friendly map and hides other codes", () => {
  assert.equal(
    friendlyError({
      code: "auth/invalid-credential",
      message: "Firebase: Error (auth/invalid-credential).",
    }),
    "Wrong email or password.",
  );
  assert.equal(
    friendlyError({ code: "unavailable", message: "x" }),
    "Can't reach the server right now.",
  );
  assert.equal(friendlyError({ message: "unknown" }), UNKNOWN);
  assert.equal(friendlyError({ message: "permission-denied/foo [12]" }), UNKNOWN);
  assert.equal(friendlyError(new Error("Not signed in [401]")), "Not signed in");
});
