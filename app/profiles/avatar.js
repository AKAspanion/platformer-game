import { cleanProfile, lastSeenLabel } from "./rules";
import { SKIN_PALETTES, tintFrames, hatImage, drawHat } from "../game/cosmetics";
import { companionFrames } from "../game/companion";
import { requestImage } from "../game/preload";

/**
 * The little dino on each leaderboard row: the idle frame in the player's skin,
 * the hat on its head and the companion beside it. Looks come from other
 * players' profiles, so they are only ever used as ids into the shop catalogue
 * (cleanProfile swaps anything else for the free item) and drawn on a canvas:
 * never parsed as HTML.
 */
export const AVATAR_SIZE = 28; // css px tall; drawn at devicePixelRatio
const AVATAR_WIDTH = 40; // css px wide: the companion stands on the left of the dino
const DINO_SCALE = 0.6; // game units to css px: keeps the tallest hat (41 units) inside 28 px
const FEET = { x: 28, y: 27 }; // where the dino's feet are, in css px
const COMPANION_PX = 16; // css px wide: a 32 px sprite at half size, a whole number of device px at 2x
const DINO_FRAME = "./assets/sprites/player/right/Idle (1).webp";
const idle = { assetCount: 0, loadCount: 0 }; // avatars never hold up a loading bar

/** The worn looks, each slot a catalogue id (the free one when unknown); null is the classic dino. */
const looksOf = (profile) => cleanProfile(profile || {});

/** The cache key for a combination. */
export function avatarKey(profile) {
  const { skin, hat, companion } = looksOf(profile);
  return `${skin}|${hat}|${companion}`;
}

const ready = (image) =>
  !!image && image.complete !== false && (image.naturalWidth || image.width) > 0;

/** Calls `again` when `image` finishes loading, if it hasn't. */
function onLoad(image, again) {
  if (image && !ready(image) && typeof image.addEventListener === "function") {
    image.addEventListener("load", again, { once: true });
  }
}

/** Draws the dino, hat and companion on `ctx` (sized AVATAR_WIDTH x AVATAR_SIZE css px at `ratio`). Returns true when every sprite was in. */
function drawLooks(ctx, look, again, ratio) {
  ctx.imageSmoothingEnabled = false;
  const dinoImage = requestImage(DINO_FRAME, idle);
  const hat = hatImage(look.hat);
  const pals = companionFrames(look.companion);
  [dinoImage, hat, pals[0]].forEach((image) => onLoad(image, again));
  let complete = ready(dinoImage) && (!hat || ready(hat)) && (!pals.length || ready(pals[0]));
  ctx.save();
  ctx.scale(ratio, ratio);
  if (pals.length && ready(pals[0])) {
    const size = COMPANION_PX / 32;
    ctx.drawImage(pals[0], 0, AVATAR_SIZE - 28 * size, 32 * size, 28 * size);
  }
  if (ready(dinoImage)) {
    const dino = tintFrames([dinoImage], SKIN_PALETTES[look.skin])[0];
    ctx.translate(FEET.x, FEET.y);
    ctx.scale(DINO_SCALE, DINO_SCALE);
    ctx.drawImage(dino, -18, -35, 60, 40);
    if (hat && ready(hat)) drawHat(ctx, hat, 1, dino);
  } else {
    complete = false;
  }
  ctx.restore();
  return complete;
}

function browserCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${AVATAR_WIDTH}px`;
  canvas.style.height = `${AVATAR_SIZE}px`;
  return canvas;
}

/**
 * An avatar maker. Each combination is drawn once (`draw`, onto a master
 * canvas) and kept; every call returns a fresh canvas holding a copy. A sprite
 * that hadn't loaded yet redraws the master, and every copy handed out, when
 * it arrives.
 */
export function createAvatars({
  makeCanvas = browserCanvas,
  draw = drawLooks,
  ratio = () => (typeof window !== "undefined" && window.devicePixelRatio) || 1,
} = {}) {
  const cache = new Map(); // key -> { master, copies, done }

  const blit = (entry, copy) => {
    const ctx = copy.getContext("2d");
    ctx.clearRect(0, 0, copy.width, copy.height);
    ctx.drawImage(entry.master, 0, 0);
  };

  function entryFor(key, look) {
    let entry = cache.get(key);
    if (entry) return entry;
    const scale = ratio();
    entry = {
      master: makeCanvas(Math.round(AVATAR_WIDTH * scale), Math.round(AVATAR_SIZE * scale)),
      copies: [],
      done: false,
    };
    const again = () => {
      const ctx = entry.master.getContext("2d");
      ctx.clearRect(0, 0, entry.master.width, entry.master.height);
      entry.done = draw(ctx, look, again, scale);
      entry.copies.forEach((copy) => blit(entry, copy));
    };
    cache.set(key, entry);
    again();
    return entry;
  }

  return {
    canvas(profile) {
      const look = looksOf(profile);
      const key = avatarKey(look);
      const entry = entryFor(key, look);
      const copy = makeCanvas(entry.master.width, entry.master.height);
      blit(entry, copy);
      if (!entry.done) entry.copies.push(copy); // repainted when its sprites arrive
      return copy;
    },
  };
}

const avatars = createAvatars();

/** A canvas with the dino's idle frame in the skin, the hat on its head, the companion beside it. */
export function avatarCanvas(profile) {
  return avatars.canvas(profile);
}

/**
 * What each board row shows: { uid, avatarKey, seen, profile }, from the rows
 * and the fetched profiles (uid -> clean profile). A uid without a profile gets
 * the classic dino and no status; a profile without seenDay gets no status.
 */
export function rowLooks(rows, profilesByUid, today) {
  return rows.map(({ uid }) => {
    const profile = (profilesByUid && profilesByUid.get(uid)) || null;
    return {
      uid,
      avatarKey: avatarKey(profile),
      seen: profile ? lastSeenLabel(profile.seenDay, today) : "",
      profile,
    };
  });
}

/**
 * Reads the profiles of the rows on the board, once. Null when they can't be
 * had (the board stays as it is, with classic dinos) or when `isCurrent()` says
 * the board has moved on to another tab by the time they arrive.
 */
export async function loadProfiles(uids, { fetch, isCurrent }) {
  let found;
  try {
    found = await fetch(uids);
  } catch (error) {
    console.warn("Profiles failed:", error && error.code ? error.code : error && error.name);
    return null;
  }
  return isCurrent() ? found : null;
}
