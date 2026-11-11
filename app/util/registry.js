/**
 * Runtime asset registry for generated worlds (see app/gen).
 *
 * Story levels load their tiles, music and sounds from app/assets. A world
 * made with the world creator has none of those files: its art and audio are
 * generated in the browser and registered here, and the engine asks the
 * registry first before falling back to the asset paths.
 */

const audio = {}; // "file.ext" or "file" -> url (blob: or data:)
const skins = {}; // skin id -> { tiles, objects, background, liquid }

/** URL for a music file or sound: a generated one if registered, else the asset path. */
export const audioSrc = (file, ext = "mp3", folder = "") =>
  audio[file] || `./assets/audio/${folder}${file}.${ext}`;

export const registerAudio = (file, url) => {
  audio[file] = url;
};

export const hasAudio = (file) => !!audio[file];

/** A generated tile set: `tiles[id]` / `objects[id]` are canvases (index 0 unused). */
export const registerSkin = (id, skin) => {
  skins[id] = skin;
};

export const getSkin = (id) => (id ? skins[id] || null : null);
