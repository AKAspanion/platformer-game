/**
 * First-run rules: skip the home screen once on a fresh device, a controls
 * hint during that run, and a one-time card after the world 1 boss.
 *
 * Flags live in one localStorage key. A blocked, full or corrupt store never
 * throws, and never lets a one-time flow repeat: a take returns false unless
 * its flag was read as unset and then saved.
 */
const KEY = "onboarding";
/** Grassland 6, the world 1 boss (LEVELS in app/util). */
const WORLD1_BOSS_ID = 25;

export const HINT_TIMEOUT = 15000; // ms
export const HINT_KEYBOARD = "← → move · ↑ or Space jump · Enter fire";
export const HINT_TOUCH = "Use the buttons to move, jump and fire";

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (e) {
    return null;
  }
}

function hasProgress(campaign) {
  const reached = (campaign && campaign.reached) || [];
  const stars = (campaign && campaign.stars) || {};
  return reached.some((id) => id !== 1) || Object.values(stars).some((mask) => mask > 0);
}

export function createOnboarding(storage = defaultStorage()) {
  /** The saved flags, or null when the store is blocked or corrupt. */
  function read() {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null || raw === undefined) return {};
      const flags = JSON.parse(raw);
      if (flags === null || typeof flags !== "object" || Array.isArray(flags)) return null;
      return flags;
    } catch (e) {
      return null;
    }
  }

  function write(flags) {
    try {
      storage.setItem(KEY, JSON.stringify(flags));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Sets a flag; true only when it was unset and the save worked. */
  function take(name) {
    const flags = read();
    if (!flags || flags[name]) return false;
    return write({ ...flags, [name]: true });
  }

  return {
    takeFirstOpen(campaign) {
      if (hasProgress(campaign)) {
        take("firstOpenDone"); // best effort: later opens stay on the home screen
        return false;
      }
      return take("firstOpenDone");
    },

    hintText(touch) {
      return touch ? HINT_TOUCH : HINT_KEYBOARD;
    },

    startHint(now) {
      let moved = false;
      let jumped = false;
      return {
        moved() {
          moved = true;
        },
        jumped() {
          jumped = true;
        },
        tick(at) {
          const elapsed = at - now;
          if (moved && jumped) return { reason: "played", seconds: Math.round(elapsed / 1000) };
          if (elapsed >= HINT_TIMEOUT)
            return { reason: "timeout", seconds: Math.round(elapsed / 1000) };
          return null;
        },
      };
    },

    hintDone() {
      const flags = read();
      if (flags) write({ ...flags, hintDone: true });
    },

    takeWorld1Offer(levelId) {
      if (levelId !== WORLD1_BOSS_ID) return false;
      return take("world1OfferShown");
    },
  };
}
