const CACHE_NAME = "dino-v26";

// Daily reminders (web push through Firebase Cloud Messaging).
// The service worker can't import modules: this repeats the daily copy from
// app/reminders/rules.js (TITLE, reminderFor) for a push that carries none.
const FALLBACK_TITLE = "Dino's Adventure";
const FALLBACK_BODY = "Today's challenge is up. 5 new levels are waiting.";
const OPEN_URL = "/?from=reminder";

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }
  const note = (payload && payload.notification) || {};
  const title = typeof note.title === "string" && note.title ? note.title : FALLBACK_TITLE;
  const body = typeof note.body === "string" && note.body ? note.body : FALLBACK_BODY;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./images/icons-192.png",
      tag: "daily-reminder",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        // focus the open game and send it to the reminder's address
        return open.focus().then(() => open.navigate(OPEN_URL).catch(() => {}));
      }
      return self.clients.openWindow(OPEN_URL);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (CACHE_NAME !== cacheName) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});

// Network first, cache as the offline fallback. Only the game's own GET files
// are cached: Firebase's reserved /__/ paths (sign-in handler URLs carry OAuth
// state), other origins (Firestore, Google APIs) and POSTs go straight to the
// network. Every page address (/?world=…, /?from=reminder) is one cached page,
// so an offline open never pairs an old page with a newer bundle.
const PAGE_KEY = "./";

const GAME_PAGES = ["/", "/index.html"];

const cacheable = (request) => {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/__/")) return false;
  // other pages (the /w/<id> world links) are served fresh, never as the game
  return request.mode !== "navigate" || GAME_PAGES.includes(url.pathname);
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!cacheable(request)) return;
  const page = request.mode === "navigate";
  const key = page ? new Request(PAGE_KEY) : request;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(key, copy))
              .catch(() => {}),
          );
        }
        return response;
      })
      .catch(() =>
        caches
          .match(key, page ? { ignoreSearch: true } : undefined)
          .then((cached) => cached || Response.error()),
      ),
  );
});
