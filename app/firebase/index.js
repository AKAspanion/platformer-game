import { firebaseConfig, FUNCTIONS_REGION } from "./config";

/**
 * Firebase, loaded on demand: only players who use the world creator (or
 * signed in before) download it, so the game itself starts as fast as ever.
 *
 *   const fb = await loadFirebase();
 *   fb.auth / fb.db / fb.functions and the modules (fb.authApi, fb.storeApi, fb.functionsApi)
 *
 * Local development against the emulators: run `yarn emulators` and
 * `yarn dev`, open the game with ?emulators=1 (remembered until
 * ?emulators=0). The dev server proxies the emulators (webpack.config.js), so
 * everything is on the game's own origin.
 */

const emulatorsWanted = () => {
  try {
    const flag = new URLSearchParams(location.search).get("emulators");
    if (flag === "1") localStorage.setItem("useEmulators", "1");
    if (flag === "0") localStorage.removeItem("useEmulators");
    return localStorage.getItem("useEmulators") === "1";
  } catch (error) {
    return false;
  }
};

let loading = null;

export function loadFirebase() {
  if (loading) return loading;
  loading = (async () => {
    const [appApi, authApi, storeApi, functionsApi] = await Promise.all([
      import(/* webpackChunkName: "firebase" */ "firebase/app"),
      import(/* webpackChunkName: "firebase" */ "firebase/auth"),
      import(/* webpackChunkName: "firebase" */ "firebase/firestore"),
      import(/* webpackChunkName: "firebase" */ "firebase/functions"),
    ]);
    const app = appApi.initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    const db = storeApi.getFirestore(app);
    const functions = functionsApi.getFunctions(app, FUNCTIONS_REGION);
    const emulators = emulatorsWanted();
    if (emulators) {
      const port = Number(location.port) || (location.protocol === "https:" ? 443 : 80);
      authApi.connectAuthEmulator(auth, location.origin, { disableWarnings: true });
      storeApi.connectFirestoreEmulator(db, location.hostname, port);
      functionsApi.connectFunctionsEmulator(functions, location.hostname, port);
    }
    return { app, auth, db, functions, authApi, storeApi, functionsApi, emulators };
  })();
  // offline: let the next call try again
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Firebase errors as something a player can act on. */
export function friendlyError(error) {
  const fullCode = String((error && error.code) || "");
  // callable functions send messages written for players (functions/src/handlers.js)
  if (/^functions\//.test(fullCode) && fullCode !== "functions/internal" && error.message) {
    const message = error.message.replace(/\s*\[\d{3}\]$/, ""); // the SDK adds the HTTP status
    if (!/^(internal|unavailable|deadline-exceeded)$/i.test(message)) return message;
  }
  const code = fullCode.replace(/^(auth|functions|firestore)\//, "");
  const messages = {
    "invalid-credential": "Wrong email or password.",
    "wrong-password": "Wrong email or password.",
    "user-not-found": "No account with that email. Create one?",
    "email-already-in-use": "That email already has an account. Sign in instead.",
    "weak-password": "Use a password with at least 6 characters.",
    "invalid-email": "That email doesn't look right.",
    "missing-password": "Enter your password.",
    "popup-closed-by-user": "Sign-in was cancelled.",
    "cancelled-popup-request": "Sign-in was cancelled.",
    "network-request-failed": "No connection. Check your internet and try again.",
    "too-many-requests": "Too many tries. Wait a bit and try again.",
    "unauthorized-domain": "Google sign-in isn't enabled for this site yet.",
    "operation-not-allowed": "That sign-in method isn't enabled yet.",
    "user-disabled": "This account has been disabled.",
    unavailable: "Can't reach the server right now.",
    "deadline-exceeded": "The server took too long. Try again.",
  };
  if (messages[code]) return messages[code];
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically/i.test(String(error))) {
    return messages["network-request-failed"];
  }
  // anything else with a readable message
  if (error && error.message && !/^Firebase:/.test(error.message)) return error.message;
  return "Something went wrong. Try again.";
}
