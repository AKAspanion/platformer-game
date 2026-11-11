/**
 * The game's build-time settings: `.env` at the repo root (see `.env.example`),
 * with variables already set in the environment taking precedence (CI).
 *
 *   const { firebaseEnv, missingFirebaseEnv } = require("./scripts/load-env");
 */
const fs = require("fs");
const path = require("path");

const ENV_FILE = path.resolve(__dirname, "..", ".env");

/** Everything the web app's Firebase config reads. */
const FIREBASE_KEYS = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_MEASUREMENT_ID",
  "FIREBASE_VAPID_KEY",
  "FIREBASE_APPCHECK_SITE_KEY",
  "FIREBASE_APPCHECK_DEBUG_TOKEN",
];

/** Never in a release build: a debug token lets anything pass App Check. */
const DEV_ONLY_KEYS = ["FIREBASE_APPCHECK_DEBUG_TOKEN"];

/** Without these the game cannot reach Firebase at all. */
const REQUIRED_KEYS = ["FIREBASE_API_KEY", "FIREBASE_PROJECT_ID", "FIREBASE_APP_ID"];

// process.loadEnvFile never overwrites a variable that is already set
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const firebaseEnv = Object.fromEntries(
  FIREBASE_KEYS.map((key) => [key, (process.env[key] || "").trim()]),
);

const missingFirebaseEnv = REQUIRED_KEYS.filter((key) => !firebaseEnv[key]);

/** The values a build may carry: dev-only ones are dropped from production builds. */
const buildEnv = (mode) =>
  Object.fromEntries(
    Object.entries(firebaseEnv).filter(
      ([key, value]) => value && !(mode === "production" && DEV_ONLY_KEYS.includes(key)),
    ),
  );

module.exports = {
  ENV_FILE,
  FIREBASE_KEYS,
  REQUIRED_KEYS,
  DEV_ONLY_KEYS,
  firebaseEnv,
  missingFirebaseEnv,
  buildEnv,
};
