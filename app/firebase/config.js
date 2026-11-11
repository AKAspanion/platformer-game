/** Domains where the game is served by Firebase Hosting under its own name. */
const GAME_DOMAINS = ["dino.spanion.in"];

/**
 * The Firebase web app config for project dinos-adventure. These values are
 * public by design (they identify the project; Firestore rules, Auth and the
 * functions' own checks protect the data).
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDoikj6QuF_FRUhfUJjBqcT25Ov6ICcgjU",
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
    : "dinos-adventure.firebaseapp.com",
  projectId: "dinos-adventure",
  storageBucket: "dinos-adventure.firebasestorage.app",
  messagingSenderId: "866926651940",
  appId: "1:866926651940:web:143a267cfaddc751e786b1",
  // Google Analytics's ID (Firebase console > Project settings > Your apps). Empty until
  // Analytics is enabled on the project: nothing is sent while it is empty.
  measurementId: "G-8CE4091V3T",
};

/** Where the world creator's functions run (next to the Firestore database). */
export const FUNCTIONS_REGION = "asia-south1";
