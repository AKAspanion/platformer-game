import { loadFirebase } from "./index";
import { firebaseConfig } from "./config";

/** How long to wait for the game's service worker before giving up. */
const SW_READY_MS = 10000;

/**
 * Web push tokens from Firebase Cloud Messaging. firebase/messaging is its own
 * chunk, loaded only when reminders are turned on or the game opens with them
 * on (app/reminders/push.js), never at startup.
 */
export async function webToken() {
  const [fb, messagingApi] = await Promise.all([
    loadFirebase(),
    import(/* webpackChunkName: "firebase-messaging" */ "firebase/messaging"),
  ]);
  if (!(await messagingApi.isSupported())) throw new Error("push isn't supported here");
  // the game's own service worker (app/sw.js) receives the pushes
  // .ready never settles when registration failed: give up instead of hanging
  const serviceWorkerRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve, reject) =>
      setTimeout(() => reject(new Error("the service worker isn't running")), SW_READY_MS),
    ),
  ]);
  return messagingApi.getToken(messagingApi.getMessaging(fb.app), {
    vapidKey: firebaseConfig.vapidKey,
    serviceWorkerRegistration,
  });
}
