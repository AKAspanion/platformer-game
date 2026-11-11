import { loadFirebase } from "./index";
import { firebaseConfig } from "./config";

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
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  return messagingApi.getToken(messagingApi.getMessaging(fb.app), {
    vapidKey: firebaseConfig.vapidKey,
    serviceWorkerRegistration,
  });
}
