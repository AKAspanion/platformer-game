# Android app (Trusted Web Activity)

The Play Store app is a [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) Trusted Web Activity
that opens <https://dino.spanion.in> full-screen in landscape.

- Package: `in.spanion.dino.twa` (the old PWABuilder app, `io.github.akaspanion.twa`, is a separate Play app;
  its statement stays in `app/assetlinks.json` so existing installs keep opening full-screen).
- Config: `twa-manifest.json`. Everything else here is generated from it.
- Target and compile SDK 36, min SDK 24. Notification delegation is on, so the web push reminders show as
  the app's notifications.
- The upload key, its password, the signed builds and the store graphics live outside the repo in
  `~/keys/dino/` (its `README.txt` lists each file). Never commit them.
- `app/assetlinks.json` (served at `/.well-known/assetlinks.json`) must list the upload key's SHA-256 and,
  after the first Play upload, Play's app-signing key SHA-256 (Play Console → Test and release →
  App integrity). Without Play's key, store installs open with a browser URL bar.

## Regenerate after changing `twa-manifest.json`

```bash
cd packages/android
npx --yes @bubblewrap/cli@1.27.0 update --skipVersionUpgrade
```

Then:

1. Re-apply the splash URI grant in `app/src/main/java/in/spanion/dino/twa/LauncherActivity.java`
   (`grantSplashUriPermission()` called before `super.onCreate()`). Chrome 152+ drops the splash image
   without it; remove it once GoogleChrome/android-browser-helper#623 is fixed.
2. Check `compileSdkVersion` and `targetSdkVersion` in `app/build.gradle` are still at least 36.
3. Commit `manifest-checksum.txt` with the regenerated project.

## Signed release

Raise `appVersionCode` (and `appVersion`) in `twa-manifest.json` and regenerate first. `bubblewrap build`
refuses an Android SDK without a `tools/` or `bin/` folder, so build with Gradle and sign by hand
(replace `1.0.0-1` with the new version and code):

```bash
cd packages/android
export ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 21)
./gradlew bundleRelease assembleRelease
PW=$(cat ~/keys/dino/keystore-password.txt) BT=~/Library/Android/sdk/build-tools/36.1.0

cp app/build/outputs/bundle/release/app-release.aab ~/keys/dino/app-release-1.0.0-1.aab
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore ~/keys/dino/upload.keystore \
  -storepass "$PW" -keypass "$PW" ~/keys/dino/app-release-1.0.0-1.aab upload

$BT/zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk app/build/aligned.apk
$BT/apksigner sign --v4-signing-enabled false --ks ~/keys/dino/upload.keystore --ks-key-alias upload \
  --ks-pass pass:"$PW" --key-pass pass:"$PW" --out ~/keys/dino/app-release-1.0.0-1.apk app/build/aligned.apk
```

Upload the `.aab` to Play. The `.apk` is for installing by hand (`adb install -r`).
