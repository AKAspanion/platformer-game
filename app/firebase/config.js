/** Domains where the game is served by Firebase Hosting under its own name. */
const GAME_DOMAINS = ["dino.spanion.in"];

/**
 * The Firebase web app config, read from the environment at build time
 * (`.env`, see `.env.example`; CI writes it from the APP_ENV secret). The
 * values identify the project; Firestore rules, Auth and the functions' own
 * checks protect the data. A build without them plays offline: anything that
 * needs Firebase reports that it is unavailable.
 */
const env = typeof __FIREBASE_ENV__ === "object" && __FIREBASE_ENV__ ? __FIREBASE_ENV__ : {};
const projectId = env.FIREBASE_PROJECT_ID || "";

export const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY || "",
  // Google sign-in's handler page (/__/auth/handler). Sign-in is a redirect, and
  // browsers that block third-party storage (Safari, Firefox, Chrome on some
  // settings) lose a redirect's result unless the handler is on the game's own
  // domain. Firebase Hosting serves it on dino.spanion.in too, so the game uses
  // that there. Needs https://dino.spanion.in/__/auth/handler listed as an
  // authorized redirect URI of the project's OAuth web client (Google Cloud
  // console > APIs & Services > Credentials); localhost and preview channels
  // keep the default handler.
  authDomain: GAME_DOMAINS.includes(globalThis.location && location.hostname)
    ? location.hostname
    : env.FIREBASE_AUTH_DOMAIN || (projectId && `${projectId}.firebaseapp.com`),
  projectId,
  storageBucket: env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.FIREBASE_APP_ID || "",
  // Google Analytics's ID (Firebase console > Project settings > Your apps).
  // Nothing is sent while it is empty.
  measurementId: env.FIREBASE_MEASUREMENT_ID || "",
  // The web push key (Firebase console > Project settings > Cloud Messaging > Web Push
  // certificates). Web reminders are off while it is empty.
  vapidKey: env.FIREBASE_VAPID_KEY || "",
};

/** App Check (app/firebase/app-check.js): the reCAPTCHA Enterprise site key; a debug token for local builds. */
export const appCheckConfig = {
  siteKey: env.FIREBASE_APPCHECK_SITE_KEY || "",
  debugToken: env.FIREBASE_APPCHECK_DEBUG_TOKEN || "",
};

/** True when the build has a Firebase project to talk to. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/** Where the world creator's functions run (next to the Firestore database). */
export const FUNCTIONS_REGION = "asia-south1";
