import { firebaseConfig } from "../firebase/config";
import { settings } from "../util/settings";

export const MAX_QUEUE = 50;
export const START_DELAY = 3000;

/** Keys that could identify a player: never sent, whatever the caller passes. */
const FORBIDDEN = ["uid", "name", "email", "user_id", "userid", "displayname"];

const clean = (params) => {
  const out = {};
  Object.keys(params || {}).forEach((key) => {
    if (!FORBIDDEN.includes(key.toLowerCase())) out[key] = params[key];
  });
  return out;
};

const realTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/**
 * Analytics core, with the sink and the clock passed in so it can be tested.
 * Events are queued (at most MAX_QUEUE, oldest dropped) until the sink loads.
 * Nothing in here throws: a blocked or offline sink just means no events.
 */
export function createAnalytics({ load, enabled, debug, timers = realTimers }) {
  let forced = null; // set by setEnabled, wins over the `enabled` option
  let queue = [];
  let sink = null;
  let starting = null;
  let failed = false;

  const isOn = () => {
    if (forced !== null) return forced;
    try {
      return !!enabled();
    } catch (error) {
      return false;
    }
  };

  const send = (event) => {
    try {
      if (debug) console.debug("[analytics]", event.name, event.params);
      else sink.log(event.name, event.params);
    } catch (error) {
      // a failing sink must never reach the game
    }
  };

  const track = (name, params) => {
    try {
      if (failed || !isOn()) return;
      const event = { name, params: clean(params) };
      if (debug && starting) return send(event);
      if (sink) return send(event);
      queue.push(event);
      if (queue.length > MAX_QUEUE) queue.shift();
    } catch (error) {
      // never throws
    }
  };

  const flush = () => {
    const events = queue;
    queue = [];
    if (isOn()) events.forEach(send);
  };

  const start = () => {
    if (starting) return starting;
    if (!isOn()) return Promise.resolve();
    if (debug) {
      // console only: the analytics code is never loaded
      starting = Promise.resolve();
      flush();
      return starting;
    }
    starting = (async () => {
      try {
        sink = await load();
        flush();
      } catch (error) {
        failed = true;
        queue = [];
      }
    })();
    return starting;
  };

  const setEnabled = (on) => {
    forced = !!on;
    if (!forced) queue = [];
  };

  /**
   * Starts loading on the first input, or `delay` ms from now, whichever comes
   * first. Returns a function that cancels both.
   */
  const arm = (target, delay = START_DELAY) => {
    const types = ["keydown", "pointerdown", "touchstart", "mousedown"];
    let id = null;
    const stop = () => {
      timers.clearTimeout(id);
      types.forEach((type) => target.removeEventListener(type, fire));
    };
    function fire() {
      stop();
      start();
    }
    types.forEach((type) => target.addEventListener(type, fire, { passive: true }));
    id = timers.setTimeout(fire, delay);
    return stop;
  };

  return { track, start, setEnabled, arm, queued: () => queue.length };
}

// ------------------------------------------------------------- app_open

const dayNumber = (date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/**
 * Parameters of `app_open`: whether the player has been here before and how
 * many days ago they first opened the game. `store` has get/set; the local
 * date of the first open is kept under "first_open".
 */
export function appOpenParams(store, now = new Date()) {
  let first = null;
  try {
    first = store.get("first_open");
  } catch (error) {
    first = null;
  }
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(first || "");
  if (!match) {
    try {
      store.set("first_open", dayKey(now));
    } catch (error) {
      // private mode: counts as a first open every time
    }
    return { returning: false, days_since_first: 0 };
  }
  const firstDay = dayNumber(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return { returning: true, days_since_first: Math.max(0, dayNumber(now) - firstDay) };
}

// ------------------------------------------------------------ the game's

const noSink = { log() {} };

/** Firebase Analytics, loaded lazily; a no-op until measurementId is set. */
async function loadSink() {
  if (!firebaseConfig.measurementId) return noSink;
  const { loadFirebase } = await import("../firebase");
  const { app } = await loadFirebase();
  const api = await import(/* webpackChunkName: "firebase" */ "firebase/analytics");
  if (!(await api.isSupported())) return noSink;
  const analytics = api.getAnalytics(app);
  return { log: (name, params) => api.logEvent(analytics, name, params) };
}

const isDebug = () => {
  try {
    const { hostname, search } = window.location;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname) || /[?&]debug\b/.test(search);
  } catch (error) {
    return false;
  }
};

let shared = null;
const instance = () =>
  shared ||
  (shared = createAnalytics({
    load: loadSink,
    enabled: () => settings.get("analytics") !== false,
    debug: isDebug(),
  }));

/** Records an event; queued until analytics loads. Never throws. */
export function track(name, params) {
  try {
    instance().track(name, params);
  } catch (error) {
    // never throws
  }
}

/** Starts loading analytics. Idempotent. */
export function startAnalytics() {
  try {
    return instance().start();
  } catch (error) {
    return Promise.resolve();
  }
}

/** Starts analytics on the first input, or 3 s after this call. */
export function armAnalytics(target = window) {
  try {
    return instance().arm(target);
  } catch (error) {
    return () => {};
  }
}

/** Turns analytics on or off; off drops the queue and stops sending. */
export function setAnalyticsEnabled(on) {
  try {
    settings.set("analytics", !!on);
    instance().setEnabled(on);
  } catch (error) {
    // never throws
  }
}
