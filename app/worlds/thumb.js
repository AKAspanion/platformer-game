import { THUMB_SIZE, MAX_THUMB_BYTES } from "./community.js";

const PREFIX = "data:image/png;base64,";

/** The bytes a base64 string holds. */
const bytesOf = (base64) =>
  Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

/**
 * The publish thumbnail: the world's preview drawn at 480x270, as base64 PNG,
 * or null if it is over MAX_THUMB_BYTES (the world then publishes without one).
 * `make` builds the scratch canvas (the browser's by default).
 */
export function publishThumb(canvas, make = () => document.createElement("canvas")) {
  try {
    const out = make();
    out.width = THUMB_SIZE.width;
    out.height = THUMB_SIZE.height;
    const context = out.getContext("2d");
    // the preview is pixel art: scale it without smoothing
    context.imageSmoothingEnabled = false;
    context.drawImage(canvas, 0, 0, THUMB_SIZE.width, THUMB_SIZE.height);
    const url = out.toDataURL("image/png");
    if (typeof url !== "string" || !url.startsWith(PREFIX)) return null;
    const base64 = url.slice(PREFIX.length);
    return base64 && bytesOf(base64) <= MAX_THUMB_BYTES ? base64 : null;
  } catch (error) {
    return null;
  }
}
