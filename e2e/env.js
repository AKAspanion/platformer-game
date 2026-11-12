/**
 * Where the end-to-end tests find the game and the Firebase emulators
 * (ports from firebase.json). A demo- project id keeps the emulators off the
 * network: anything not emulated fails instead of reaching a real project.
 */
const PROJECT_ID = "demo-dino";
const GAME_PORT = 2111;
const AUTH_EMULATOR = "http://127.0.0.1:9099";
const FIRESTORE_EMULATOR = "http://127.0.0.1:8085";

module.exports = { PROJECT_ID, GAME_PORT, AUTH_EMULATOR, FIRESTORE_EMULATOR };
