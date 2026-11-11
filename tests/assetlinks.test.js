import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const links = read("app/assetlinks.json");
const twa = read("packages/android/twa-manifest.json");
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const forPackage = (name) => links.find((l) => l.target.package_name === name);

test("the Android app's package opens the site full-screen with its upload key", () => {
  assert.equal(twa.packageId, "in.spanion.dino.twa");
  assert.equal(twa.host, "dino.spanion.in");
  const link = forPackage(twa.packageId);
  assert.ok(link, "assetlinks.json has no statement for the TWA package");
  assert.deepEqual(link.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(link.target.namespace, "android_app");
  // The upload key signs builds installed by hand; Play's app-signing key joins it after the first upload.
  assert.ok(
    link.target.sha256_cert_fingerprints.includes(
      "B9:0B:AF:2F:63:0A:1F:05:CF:48:FD:53:65:C2:63:68:A1:52:83:9C:86:3D:16:FD:A4:EC:25:EB:67:CC:D8:29",
    ),
  );
});

test("installs of the old Play app keep opening full-screen", () => {
  assert.ok(forPackage("io.github.akaspanion.twa"));
});

test("every fingerprint is 32 colon-separated uppercase hex pairs", () => {
  const all = links.flatMap((l) => l.target.sha256_cert_fingerprints);
  assert.ok(all.length > 0);
  assert.deepEqual(
    all.filter((f) => !FINGERPRINT.test(f)),
    [],
  );
});
