/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package in.spanion.dino.twa;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.File;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "LauncherActivity";

    // Chrome 152+ only accepts the splash image when the app that sends it holds a grant on its URI, and the
    // library never grants one to itself. Re-apply this after Bubblewrap regenerates this file, and remove it
    // once GoogleChrome/android-browser-helper#623 is fixed.
    private void grantSplashUriPermission() {
        try {
            File splash = new File(getFilesDir(), "twa_splash/splash_image.png");
            Uri uri = FileProvider.getUriForFile(this, getString(R.string.providerAuthority), splash);
            grantUriPermission(getPackageName(), uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        } catch (Exception e) {
            // The launch goes on without a splash, as it did before the grant.
            Log.w(TAG, "Could not grant the splash image to the app", e);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        grantSplashUriPermission();
        super.onCreate(savedInstanceState);
        // The landscape lock is android:screenOrientation="sensorLandscape" in AndroidManifest.xml,
        // not a setRequestedOrientation() call here: set at runtime, Android first draws the
        // starting window in portrait and rotates it, which flashes the home screen and a sideways
        // icon on a cold launch. The fixed orientation is safe on Android 8.0 because the launcher's
        // theme is opaque (res/values/launcher_theme.xml; bubblewrap#496 is about translucent ones).
        // Re-apply after Bubblewrap regenerates this file.
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }
}
