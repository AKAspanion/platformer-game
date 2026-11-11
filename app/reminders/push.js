import { auth } from "../auth";
import { firestoreDaily } from "../firebase/daily";
import { firebaseConfig } from "../firebase/config";
import { webToken } from "../firebase/messaging";

/**
 * Daily reminders on this device: web push through Firebase Cloud Messaging,
 * or the iPhone app's own push bridge. Turning them on asks the system for
 * permission (never at load), gets this device's token and saves it with the
 * setReminders function; turning them off removes this device only.
 *
 *   reminders.state()     -> "on" | "off" | "blocked" | "unsupported"
 *   reminders.turnOn()    -> the state; throws a player-readable Error when it can't
 *   reminders.turnOff()   -> "off"
 *   reminders.refresh()   -> re-sends the token and time zone when the game opens with them on
 *
 * createReminders takes everything outside as `env`, so the tests use fakes.
 */

const KEY = "reminders";
const FAILED = "Couldn't turn on reminders. Try again later.";
const MAX_TOKEN = 4096;
const BRIDGE_TIMEOUT = 15000;

const validToken = (token) =>
  typeof token === "string" && token.length > 0 && token.length <= MAX_TOKEN && token !== "ERROR GET TOKEN";

export function createReminders(env) {
  const log = env.log || (() => {});

  const read = () => {
    try {
      const value = JSON.parse(env.storage.getItem(KEY));
      if (value && typeof value === "object") {
        return { on: value.on === true, token: typeof value.token === "string" ? value.token : "" };
      }
    } catch (error) {
      // unreadable: same as never turned on
    }
    return { on: false, token: "" };
  };
  const write = (value) => {
    try {
      env.storage.setItem(KEY, JSON.stringify(value));
    } catch (error) {
      log("storage", error);
    }
  };

  const failed = (step, error) => {
    log(step, error);
    return new Error(FAILED);
  };

  const iosState = async () => {
    try {
      return (await env.ios.permission()) === "denied" ? "blocked" : "off";
    } catch (error) {
      log("ios-permission", error);
      return "off";
    }
  };

  const webState = async () => {
    if (!(await env.web.supported())) return "unsupported";
    return env.web.permission() === "denied" ? "blocked" : "off";
  };

  async function state() {
    if (read().on) return "on";
    return env.ios.available() ? iosState() : webState();
  }

  /** Asks the system for permission; "granted" or "blocked". */
  async function ask(ios) {
    if (ios) {
      if ((await env.ios.requestPermission()) !== "granted") return "blocked";
    } else if ((await env.web.requestPermission()) !== "granted") {
      return "blocked";
    }
    return "granted";
  }

  async function turnOn() {
    const ios = env.ios.available();
    const before = await state();
    if (before === "on") return "on";
    if (before === "blocked" || before === "unsupported") return before;

    let token;
    try {
      if ((await ask(ios)) === "blocked") return "blocked";
      token = await (ios ? env.ios.token() : env.web.token());
    } catch (error) {
      throw failed("permission", error);
    }
    if (!validToken(token)) throw failed("token", new Error("bad token"));

    try {
      await env.ensurePlayer();
      await env.call("setReminders", {
        on: true,
        token,
        platform: ios ? "ios" : "web",
        timeZone: env.timeZone(),
      });
    } catch (error) {
      throw failed("save", error);
    }
    write({ on: true, token });
    return "on";
  }

  async function turnOff() {
    const { token } = read();
    write({ on: false, token: "" });
    if (token) {
      try {
        await env.call("setReminders", { on: false, token });
      } catch (error) {
        log("turn-off", error);
      }
    }
    return state();
  }

  async function refresh() {
    try {
      const saved = read();
      if (!saved.on) return;
      const ios = env.ios.available();
      if (!ios && env.web.permission() !== "granted") return;
      const token = await (ios ? env.ios.token() : env.web.token());
      if (!validToken(token)) return;
      await env.ensurePlayer();
      await env.call("setReminders", {
        on: true,
        token,
        platform: ios ? "ios" : "web",
        timeZone: env.timeZone(),
      });
      if (token !== saved.token) write({ on: true, token });
    } catch (error) {
      log("refresh", error);
    }
  }

  return { state, turnOn, turnOff, refresh };
}

// --- the iPhone app's bridge: the page asks, the app answers with a window event ---

const handler = (name) => {
  const handlers = typeof window !== "undefined" && window.webkit && window.webkit.messageHandlers;
  return handlers && Object.hasOwn(handlers, name) ? handlers[name] : null;
};

/** Posts to the app and waits for its event; rejects after `ms`. */
function bridge(name, ms = BRIDGE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const target = handler(name);
    if (!target) return reject(new Error("no bridge"));
    const done = (fn, value) => {
      clearTimeout(timer);
      window.removeEventListener(name, listener);
      fn(value);
    };
    const listener = (event) => done(resolve, event.detail);
    const timer = setTimeout(() => done(reject, new Error("bridge timeout")), ms);
    window.addEventListener(name, listener);
    try {
      target.postMessage("");
    } catch (error) {
      done(reject, error);
    }
  });
}

const iosBridge = {
  available: () => !!handler("push-token") && !!handler("push-permission-request"),
  requestPermission: async () => ((await bridge("push-permission-request")) === "granted" ? "granted" : "denied"),
  async permission() {
    // the state check is optional: an app that doesn't answer just isn't "blocked"
    if (!handler("push-permission-state")) return "notDetermined";
    return String(await bridge("push-permission-state"));
  },
  token: () => bridge("push-token"),
};

const webPush = {
  // no key, no Notification, service worker or push: nothing to offer (loads nothing)
  supported: async () =>
    !!firebaseConfig.vapidKey &&
    typeof Notification !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window,
  permission: () => Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  token: webToken,
};

export const reminders = createReminders({
  ios: iosBridge,
  web: webPush,
  call: (name, data) => firestoreDaily.call(name, data),
  ensurePlayer: () => auth.ensurePlayer(),
  timeZone: () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (error) {
      return "UTC";
    }
  },
  storage: localStorage,
  log: (step, error) => console.warn("reminders:", step, (error && error.code) || (error && error.name) || "error"),
});
