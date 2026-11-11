// Touch button opacity: idle and while pressed, per the Settings "Control opacity" choice.
export const CONTROL_OPACITY = {
  low: { idle: 0.25, pressed: 0.55 },
  medium: { idle: 0.45, pressed: 0.75 },
  high: { idle: 0.7, pressed: 1 },
};

/** Opacity for a setting value; anything unknown is "medium". */
export function controlOpacity(value) {
  return Object.hasOwn(CONTROL_OPACITY, value) ? CONTROL_OPACITY[value] : CONTROL_OPACITY.medium;
}
