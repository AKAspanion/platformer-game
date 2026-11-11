/**
 * A custom touch-button layout: where each of the five controls sits, as the
 * share (0..1) of the screen's width and height at the control's centre. Shares
 * follow rotation and resizing; clampToScreen pulls a control back on screen.
 */
export const CONTROL_IDS = ["leftBtn", "rightBtn", "fireBtn", "jumpBtn", "pauseBtn"];

/** No saved layout: the controls sit where the CSS puts them. */
export const DEFAULT_LAYOUT = null;

const isShare = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/** The layout's known controls with a valid place, or null when none is. */
export function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  CONTROL_IDS.forEach((id) => {
    const place = raw[id];
    if (place && isShare(place.x) && isShare(place.y)) out[id] = { x: place.x, y: place.y };
  });
  return Object.keys(out).length ? out : null;
}

const sizeOf = (size) =>
  typeof size === "number"
    ? { width: size, height: size }
    : { width: size.width, height: size.height };

/** `value` held between lo and hi; a range too small to fit takes lo. NaN is the middle. */
const hold = (value, lo, hi) => {
  if (hi < lo) return lo;
  if (Number.isNaN(value)) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, value));
};

/**
 * Where a control of `size` (a number, or { width, height }) goes in pixels so
 * that its centre is at x and y of the viewport, held fully on screen inside the
 * safe area ({ top, right, bottom, left }).
 */
export function clampToScreen({ x, y }, size, viewport, safeArea) {
  const { width, height } = sizeOf(size);
  return {
    left: hold(
      x * viewport.width - width / 2,
      safeArea.left,
      viewport.width - safeArea.right - width,
    ),
    top: hold(
      y * viewport.height - height / 2,
      safeArea.top,
      viewport.height - safeArea.bottom - height,
    ),
  };
}

/** The share of the viewport at the centre of a control placed at left and top. */
export function toFractions(left, top, size, viewport) {
  const { width, height } = sizeOf(size);
  return { x: (left + width / 2) / viewport.width, y: (top + height / 2) / viewport.height };
}
