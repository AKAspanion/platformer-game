import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../app/shop/catalog";
import {
  DAY_MS,
  PROFILE_BATCH,
  PROFILE_FIELDS,
  PROFILE_SLOTS,
  PROFILE_IDS,
  dayNumber,
  profilePayload,
  cleanProfile,
  lastSeenLabel,
} from "../app/profiles/rules";

const ids = (slot) => CATALOG[slot].map((item) => item.id);

test("constants", () => {
  assert.equal(DAY_MS, 86400000);
  assert.equal(PROFILE_BATCH, 30);
  assert.deepEqual(PROFILE_FIELDS, ["skin", "hat", "companion", "seenDay"]);
  assert.deepEqual(PROFILE_SLOTS, ["skin", "hat", "companion"]);
});

test("PROFILE_IDS come from the shop catalogue", () => {
  assert.deepEqual(PROFILE_IDS.skin, ids("skin"));
  assert.deepEqual(PROFILE_IDS.skin, ["classic", "mint", "sunset", "midnight", "ghost", "gold"]);
  assert.deepEqual(PROFILE_IDS.hat, ids("hat"));
  assert.deepEqual(PROFILE_IDS.companion, ids("companion"));
  assert.equal(PROFILE_IDS.companion[0], "none");
  assert.equal(Object.keys(PROFILE_IDS).length, 3);
});

test("dayNumber is the UTC day", () => {
  assert.equal(dayNumber(Date.UTC(2026, 10, 11, 23, 59, 59)), 20768);
  assert.equal(dayNumber(Date.UTC(2026, 10, 11, 23, 59, 59) + 1000), 20769);
});

test("profilePayload with showLastSeen", () => {
  const now = Date.UTC(2026, 10, 11, 12);
  assert.deepEqual(
    profilePayload({ skin: "mint", hat: "crown", companion: "none" }, { showLastSeen: true, now }),
    { skin: "mint", hat: "crown", companion: "none", seenDay: 20768 },
  );
});

test("profilePayload without showLastSeen has no seenDay key", () => {
  const now = Date.UTC(2026, 10, 11, 12);
  const out = profilePayload(
    { skin: "mint", hat: "crown", companion: "none" },
    { showLastSeen: false, now },
  );
  assert.deepEqual(out, { skin: "mint", hat: "crown", companion: "none" });
  assert.equal("seenDay" in out, false);
});

test("profilePayload fills free items", () => {
  assert.deepEqual(profilePayload({}, { showLastSeen: false, now: 0 }), {
    skin: "classic",
    hat: "none",
    companion: "none",
  });
});

test("profilePayload never returns a key outside PROFILE_FIELDS", () => {
  const out = profilePayload(
    { skin: "mint", fireball: "blue", name: "x" },
    { showLastSeen: true, now: 0 },
  );
  for (const key of Object.keys(out)) assert.ok(PROFILE_FIELDS.includes(key), key);
});

test("cleanProfile swaps unknown items for the free item", () => {
  assert.deepEqual(cleanProfile({ skin: "rainbow", hat: "crown", companion: 7, seenDay: 20765 }), {
    skin: "classic",
    hat: "crown",
    companion: "none",
    seenDay: 20765,
  });
});

test("cleanProfile drops a seenDay that is not a whole number", () => {
  assert.equal(
    cleanProfile({ skin: "mint", hat: "cap", companion: "none", seenDay: "20765" }).seenDay,
    null,
  );
  assert.equal(
    cleanProfile({ skin: "mint", hat: "cap", companion: "none", seenDay: 20765.5 }).seenDay,
    null,
  );
  assert.equal(cleanProfile({ skin: "mint", hat: "cap", companion: "none" }).seenDay, null);
});

test("cleanProfile of a non-object is null", () => {
  assert.equal(cleanProfile(null), null);
  assert.equal(cleanProfile("x"), null);
  assert.equal(cleanProfile(undefined), null);
});

test("cleanProfile ignores inherited keys", () => {
  assert.equal(cleanProfile({ skin: "constructor" }).skin, "classic");
});

test("lastSeenLabel", () => {
  const t = 20768;
  assert.equal(lastSeenLabel(20768, t), "Today");
  assert.equal(lastSeenLabel(20767, t), "Yesterday");
  assert.equal(lastSeenLabel(20766, t), "2d ago");
  assert.equal(lastSeenLabel(20762, t), "6d ago");
  assert.equal(lastSeenLabel(20761, t), "1w ago");
  assert.equal(lastSeenLabel(20755, t), "1w ago");
  assert.equal(lastSeenLabel(20754, t), "2w+ ago");
  assert.equal(lastSeenLabel(null, t), "");
  assert.equal(lastSeenLabel(20769, t), "Today");
});
