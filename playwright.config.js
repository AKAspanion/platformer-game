/**
 * End-to-end tests (e2e/*.spec.js) in Chromium and WebKit, against a
 * production build of the game wired to the Firebase emulators.
 *
 *   pnpm e2e              starts the emulators and the game, runs every test
 *   pnpm e2e --ui         the same, in Playwright's UI
 *
 * Needs Java (the Firestore emulator) and the browsers once:
 *   pnpm exec playwright install chromium webkit
 *
 * The game is served by webpack's dev server in production mode: it builds the
 * same bundle as `pnpm build` and proxies the emulators onto the game's own
 * origin (webpack.config.js), which is how ?emulators=1 reaches them. The build
 * gets a demo Firebase config for the demo-dino project, so nothing here can
 * touch the live project, whatever is in .env.
 */
const { defineConfig, devices } = require("@playwright/test");
const { GAME_PORT, PROJECT_ID } = require("./e2e/env");

const CI = !!process.env.CI;

// every Firebase key the build reads (scripts/load-env.js), set so .env can't fill them in
const demoFirebaseEnv = {
  FIREBASE_API_KEY: "demo-api-key",
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  FIREBASE_AUTH_DOMAIN: "",
  FIREBASE_STORAGE_BUCKET: "",
  FIREBASE_MESSAGING_SENDER_ID: "",
  FIREBASE_MEASUREMENT_ID: "",
  FIREBASE_VAPID_KEY: "",
  FIREBASE_APPCHECK_SITE_KEY: "",
  FIREBASE_APPCHECK_DEBUG_TOKEN: "",
};

module.exports = defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.js",
  use: {
    baseURL: `http://localhost:${GAME_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // both desktop profiles are 1280x720 with a keyboard (no touch controls)
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      // ready once the functions have loaded: a callable answers a bare GET with 400, not 404
      command: `node scripts/sync-functions-shared.js && firebase emulators:start --only auth,firestore,functions --project ${PROJECT_ID}`,
      url: `http://127.0.0.1:5001/${PROJECT_ID}/asia-south1/getDailyBoard`,
      timeout: 180_000,
      reuseExistingServer: !CI,
      // Ctrl+C, not a kill: the Firestore emulator is a Java process in its own process
      // group, and only the Firebase CLI's own shutdown stops it (else it keeps port 8085)
      gracefulShutdown: { signal: "SIGINT", timeout: 20_000 },
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // --no-client: no error overlay or reload socket in the page, just the production bundle;
      // warn: no log line per proxied emulator request
      command: `webpack serve --mode production --no-open --no-client --no-hot --no-live-reload --infrastructure-logging-level warn --port ${GAME_PORT}`,
      url: `http://localhost:${GAME_PORT}`,
      timeout: 180_000,
      reuseExistingServer: !CI,
      env: demoFirebaseEnv,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
