import { assetsOf } from "./world";
import { tileSetFor } from "../screen/tileset";
import { getSkin } from "../util/registry";

/**
 * One registry of every sprite and music url asked for, so each is requested
 * once, whoever asks first: a loader (the level being set up) or the
 * preloader (the next level, in the background). A loader counts an image only
 * while it is still in flight; an image already in costs the loading bar nothing.
 */
const images = new Map(); // src -> { image, done, waiters }
const tracks = new Map(); // src -> { audio, done, waiters }

const settle = (entry) => {
  if (entry.done) return;
  entry.done = true;
  const waiters = entry.waiters;
  entry.waiters = [];
  waiters.forEach((waiter) => waiter());
};

const imageEntry = (src) => {
  let entry = images.get(src);
  if (!entry) {
    const image = new Image();
    entry = { image, done: false, waiters: [] };
    // a failed image counts as in, like the loaders always did
    image.onload = image.onerror = () => settle(entry);
    image.src = src;
    images.set(src, entry);
  }
  return entry;
};

/**
 * The image for `src` for a loader: `counts` ({ assetCount, loadCount }) grows
 * only while the image is not yet in.
 */
export function requestImage(src, counts) {
  const entry = imageEntry(src);
  if (!entry.done) {
    counts.assetCount += 1;
    entry.waiters.push(() => {
      counts.loadCount += 1;
    });
  }
  return entry.image;
}

/** A music track's entry (downloaded once): { audio, done, whenDone(fn) }. */
export function requestTrack(src) {
  let entry = tracks.get(src);
  if (!entry) {
    const audio = new Audio();
    entry = { audio, done: false, waiters: [] };
    audio.addEventListener("canplaythrough", () => settle(entry), { once: true });
    audio.addEventListener("error", () => settle(entry), { once: true });
    audio.src = src;
    audio.volume = 0.5;
    tracks.set(src, entry);
  }
  return {
    audio: entry.audio,
    get done() {
      return entry.done;
    },
    whenDone(fn) {
      if (entry.done) fn();
      else entry.waiters.push(fn);
    },
  };
}

/** True when the browser asks to save data; then nothing preloads. */
export function saveDataOn() {
  return typeof navigator !== "undefined" && navigator.connection?.saveData === true;
}

/** The image for `src`: the preloaded one if it exists (loaded or in flight), else null. */
export function preloaded(src) {
  const entry = images.get(src);
  return entry ? entry.image : null;
}

/** True once that track is fully in. */
export function preloadedAudio(src) {
  const entry = tracks.get(src);
  return !!entry && entry.done;
}

/**
 * Starts downloading an area's sprites, tile set and music in the background.
 * Never changes any loader's counts, so the current level stays loaded.
 * Returns null when save-data is on or the area is missing.
 */
export function preloadArea(area) {
  if (!area || saveDataOn()) return null;
  const assets = assetsOf(area);
  const pending = [
    ...assets.images.map((src) => imageEntry(src)),
    ...assets.audio.map((src) => {
      requestTrack(src);
      return tracks.get(src);
    }),
  ];
  // a community world's art is generated in memory: no tile files to fetch
  const skin = getSkin(area.skin);
  const tiles = area.skin ? null : tileSetFor(16, 8, area.world, skin);
  return {
    done: () => pending.every((entry) => entry.done) && (!tiles || tiles.loaded),
  };
}
