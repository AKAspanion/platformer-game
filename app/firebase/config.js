/**
 * The Firebase web app config for project dinos-adventure. These values are
 * public by design (they identify the project; Firestore rules, Auth and the
 * functions' own checks protect the data).
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDoikj6QuF_FRUhfUJjBqcT25Ov6ICcgjU",
  // Google sign-in's handler page. dino.spanion.in (the game's domain) can host it
  // too once https://dino.spanion.in/__/auth/handler is an authorized redirect URI
  // of the project's OAuth client; until then this one is the only one Google accepts.
  authDomain: "dinos-adventure.firebaseapp.com",
  projectId: "dinos-adventure",
  storageBucket: "dinos-adventure.firebasestorage.app",
  messagingSenderId: "866926651940",
  appId: "1:866926651940:web:143a267cfaddc751e786b1",
};

/** Where the world creator's functions run (next to the Firestore database). */
export const FUNCTIONS_REGION = "asia-south1";
