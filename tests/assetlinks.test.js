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

// Play re-signs store installs: its app-signing key (Play Console > Test and release > App
// integrity), plus the hybrid signer (RSA + ML-DSA) Android 17+ checks. Read from the
// Play-installed APK's signing block (packages/android/README.md). Never Play's source stamp.
test("the Android app lists its upload key and every Play signing certificate, not the stamp", () => {
  const listed = forPackage("in.spanion.dino.twa").target.sha256_cert_fingerprints;
  assert.deepEqual(listed, [
    "B9:0B:AF:2F:63:0A:1F:05:CF:48:FD:53:65:C2:63:68:A1:52:83:9C:86:3D:16:FD:A4:EC:25:EB:67:CC:D8:29",
    "F8:53:5A:F5:3C:A4:7D:91:8F:FF:21:2A:BA:0E:22:29:5E:85:AE:E8:FD:09:94:65:E5:B4:92:46:F5:19:66:34",
    "45:34:A1:01:E4:D7:1F:E5:CA:2C:1C:27:51:E8:72:1F:D7:69:C6:48:51:07:D2:5C:5B:57:5D:08:01:CB:19:2D",
    "87:47:DF:D7:93:BE:8C:10:A5:31:5D:6A:2F:31:73:C4:AA:07:AD:4D:BA:3D:65:DA:40:30:FC:4F:CE:54:F7:A0",
  ]);
  assert.ok(
    !listed.includes(
      "32:57:D5:99:A4:9D:2C:96:1A:47:1C:A9:84:3F:59:D3:41:A4:05:88:45:83:FC:08:7D:F4:23:7B:73:3B:BD:6D",
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
