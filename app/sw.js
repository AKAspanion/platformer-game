const CACHE_NAME = "dino-v25";

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

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        try {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const resClone = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, resClone);
            })
            .catch((error) => {
              console.log("SW: error caching", error);
            });
        } catch (error) {
        } finally {
          return response;
        }
      })
      .catch(() => caches.match(event.request)),
  );
});
