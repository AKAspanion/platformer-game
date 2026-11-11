import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Bubblewrap (`bubblewrap update`) regenerates packages/android and drops the hand-made launch
// fixes below. These tests fail until they are re-applied (packages/android/README.md).
const ANDROID = "packages/android/app/src/main";
const read = (file) => fs.readFileSync(file, "utf8");
const twa = JSON.parse(read("packages/android/twa-manifest.json"));

const launcherEntry = () => {
  const manifest = read(`${ANDROID}/AndroidManifest.xml`);
  const start = manifest.indexOf('<activity android:name="LauncherActivity"');
  assert.ok(start >= 0, "AndroidManifest.xml has no LauncherActivity");
  return manifest.slice(start, manifest.indexOf(">", start) + 1);
};

test("the launcher is landscape from its first frame, set in the manifest", () => {
  const entry = launcherEntry();
  assert.match(entry, /android:screenOrientation="sensorLandscape"/);
  assert.match(entry, /android:theme="@style\/LauncherTheme"/);
  const java = read(`${ANDROID}/java/in/spanion/dino/twa/LauncherActivity.java`);
  // a runtime request makes Android draw the first frame in portrait and rotate it
  assert.doesNotMatch(java, /^\s*setRequestedOrientation\(/m);
});

test("the launcher grants itself the splash image before Chrome asks for it", () => {
  const java = read(`${ANDROID}/java/in/spanion/dino/twa/LauncherActivity.java`);
  const grant = java.indexOf("grantSplashUriPermission();");
  assert.ok(grant >= 0, "LauncherActivity.onCreate doesn't call grantSplashUriPermission()");
  assert.ok(grant < java.indexOf("super.onCreate(savedInstanceState);"));
});

test("the launcher's theme is opaque, in the splash colour, with a blank Android 12+ icon", () => {
  for (const dir of ["values", "values-v31"]) {
    const theme = read(`${ANDROID}/res/${dir}/launcher_theme.xml`);
    // translucent, Android ignores its orientation while it hands off to Chrome
    assert.doesNotMatch(theme, /Translucent/);
    assert.match(theme, /name="android:windowBackground">@color\/backgroundColor</);
  }
  const v31 = read(`${ANDROID}/res/values-v31/launcher_theme.xml`);
  assert.match(v31, /windowSplashScreenAnimatedIcon">@drawable\/splash_blank_icon</);
  assert.ok(fs.existsSync(`${ANDROID}/res/drawable/splash_blank_icon.xml`));
});

test("the splash, status bar and web manifest share the game's loading-screen colour", () => {
  const ink = read("app/index.css")
    .match(/--ink:\s*(#[0-9a-f]{6})/i)[1]
    .toUpperCase();
  for (const key of ["backgroundColor", "themeColor", "themeColorDark", "navigationColor"]) {
    assert.equal(twa[key].toUpperCase(), ink, `twa-manifest.json ${key}`);
  }
  assert.equal(JSON.parse(read("app/manifest.json")).background_color.toUpperCase(), ink);
});
