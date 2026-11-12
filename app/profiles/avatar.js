import { cleanProfile, lastSeenLabel } from "./rules";
import { SKIN_PALETTES, tintFrames, hatImage, drawHat } from "../game/cosmetics";
import { requestImage } from "../game/preload";

/**
 * The dino's face on the leaderboard: a square crop of the idle frame's head
 * in the player's skin, with the hat on it. Looks come from other players'
 * profiles, so they are only ever used as ids into the shop catalogue
 * (cleanProfile swaps anything else for the free item) and drawn on a canvas:
 * never parsed as HTML. The companion isn't drawn: it stands beside the dino,
 * outside a face.
 */
export const AVATAR_SIZE = 36; // css px square, unless a size is asked for; drawn at devicePixelRatio
const DINO_FRAME = "./assets/sprites/player/right/Idle (1).webp";
/**
 * The square around the head, in game units from the dino's feet (the frame is
 * drawn at -18, -35, 60 x 40 and the head spans about -5..18 across, -33..-16
 * down; a hat sits above it, its tip up to -43).
 */
const FACE = { x: -6, y: -44, size: 28 };
const BARE_FACE = { x: -5, y: -39, size: 25 }; // no hat: the head fills the square
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

/** Draws the dino's face and hat on `ctx`, `px` device pixels square. Returns true when every sprite was in. */
function drawLooks(ctx, look, again, px) {
  const dinoImage = requestImage(DINO_FRAME, idle);
  const hat = hatImage(look.hat);
  [dinoImage, hat].forEach((image) => onLoad(image, again));
  if (!ready(dinoImage)) return false;
  const box = hat ? FACE : BARE_FACE;
  const dino = tintFrames([dinoImage], SKIN_PALETTES[look.skin])[0];
  ctx.save();
  ctx.scale(px / box.size, px / box.size);
  ctx.translate(-box.x, -box.y);
  // the dino art is smooth, the hats are pixel art
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(dino, -18, -35, 60, 40);
  ctx.imageSmoothingEnabled = false;
  if (hat && ready(hat)) drawHat(ctx, hat, 1, dino);
  ctx.restore();
  return !hat || ready(hat);
}

function browserCanvas(px, size) {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  return canvas;
}

/**
 * An avatar maker. Each combination and size is drawn once (`draw`, onto a
 * master canvas) and kept; every call returns a fresh canvas holding a copy. A
 * sprite that hadn't loaded yet redraws the master, and every copy handed out,
 * when it arrives.
 */
export function createAvatars({
  makeCanvas = browserCanvas,
  draw = drawLooks,
  ratio = () => (typeof window !== "undefined" && window.devicePixelRatio) || 1,
} = {}) {
  const cache = new Map(); // key|size -> { master, copies, done }

  const blit = (entry, copy) => {
    const ctx = copy.getContext("2d");
    ctx.clearRect(0, 0, copy.width, copy.height);
    ctx.drawImage(entry.master, 0, 0);
  };

  function entryFor(key, look, size) {
    let entry = cache.get(key);
    if (entry) return entry;
    const px = Math.round(size * ratio());
    entry = { master: makeCanvas(px, size), copies: [], done: false };
    const again = () => {
      const ctx = entry.master.getContext("2d");
      ctx.clearRect(0, 0, entry.master.width, entry.master.height);
      entry.done = draw(ctx, look, again, px);
      entry.copies.forEach((copy) => blit(entry, copy));
    };
    cache.set(key, entry);
    again();
    return entry;
  }

  return {
    canvas(profile, size = AVATAR_SIZE) {
      const look = looksOf(profile);
      const entry = entryFor(`${avatarKey(look)}|${size}`, look, size);
      const copy = makeCanvas(entry.master.width, size);
      blit(entry, copy);
      if (!entry.done) entry.copies.push(copy); // repainted when its sprites arrive
      return copy;
    },
  };
}

const avatars = createAvatars();

/** A square canvas, `size` css px, with the dino's face in the skin and the hat on its head. */
export function avatarCanvas(profile, size = AVATAR_SIZE) {
  return avatars.canvas(profile, size);
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
