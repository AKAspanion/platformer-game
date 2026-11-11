import { getData, setData } from "./index";

/**
 * Player settings, kept in localStorage. Music and sound keep their original
 * keys ("mute_music", "mute_sounds") so existing players keep their choice.
 */
const DEFAULTS = {
  vibration: true,
  shake: true, // the screen shakes when the dino loses a heart
  ghost: false, // show the kept ghost of the fastest run on campaign levels
  analytics: true, // anonymous usage stats (Google Analytics); see PRIVACY.md
  controlSize: "auto", // auto | s | m | l
  controlOpacity: "medium", // low | medium | high: how see-through the touch buttons are
  controlLayout: null, // where each touch button sits (app/controller/layout.js); this device only, never in cloud save
  worldApiUrl: "", // prompt-to-world server (see server/README.md)
};

const read = (key) => {
  try {
    return getData(key);
  } catch (error) {
    return null;
  }
};

export const settings = {
  get musicMuted() {
    return !!read("mute_music");
  },
  set musicMuted(value) {
    setData("mute_music", !!value);
  },
  get soundMuted() {
    return !!read("mute_sounds");
  },
  set soundMuted(value) {
    setData("mute_sounds", !!value);
  },
  get(key) {
    const all = read("settings") || {};
    return key in all ? all[key] : DEFAULTS[key];
  },
  set(key, value) {
    const all = read("settings") || {};
    all[key] = value;
    setData("settings", all);
  },
};

/** Short vibration on supported phones, if the player hasn't turned it off. */
const PATTERNS = {
  hurt: [70],
  death: [120, 60, 200],
  kill: [18],
  armor: [10, 30, 10],
  powerup: [15, 40, 15],
  shield: [40],
  "combo-up": [12, 30, 12],
};

export const vibrate = (event) => {
  if (!settings.get("vibration")) return;
  const pattern = PATTERNS[event];
  if (!pattern || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // some browsers throw when the page hasn't had a user gesture yet
  }
};
