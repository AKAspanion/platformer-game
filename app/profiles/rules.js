/**
 * A player's public profile, players/{uid}: { skin, hat, companion, seenDay }.
 * Only the worn looks and, optionally, the UTC day last online: never a name
 * or a time. The Firestore rules check the same shape.
 */
import { CATALOG, FREE } from "../shop/catalog";

export const DAY_MS = 86400000;
/** Firestore's "in" limit, and the rules' list limit. */
export const PROFILE_BATCH = 30;
export const PROFILE_FIELDS = ["skin", "hat", "companion", "seenDay"];
export const PROFILE_SLOTS = ["skin", "hat", "companion"];

/** Item IDs a profile may hold, per slot, straight from the shop catalogue. */
export const PROFILE_IDS = {};
for (const slot of PROFILE_SLOTS) PROFILE_IDS[slot] = CATALOG[slot].map((item) => item.id);

/** The UTC day number. The rules compute the same from request.time. */
export function dayNumber(ms) {
  return Math.floor(ms / DAY_MS);
}

function ownId(slot, id) {
  return typeof id === "string" && PROFILE_IDS[slot].includes(id) ? id : FREE[slot];
}

/** The document a player writes: the worn items, plus seenDay only when showLastSeen is true. */
export function profilePayload(worn, { showLastSeen, now }) {
  const source = worn && typeof worn === "object" ? worn : {};
  const payload = {};
  for (const slot of PROFILE_SLOTS) payload[slot] = ownId(slot, source[slot]);
  if (showLastSeen) payload.seenDay = dayNumber(now);
  return payload;
}

/** A profile read from Firestore, made safe to draw. null in, null out. */
export function cleanProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const profile = {};
  for (const slot of PROFILE_SLOTS) profile[slot] = ownId(slot, raw[slot]);
  profile.seenDay = Number.isInteger(raw.seenDay) ? raw.seenDay : null;
  return profile;
}

/** "Today" | "Yesterday" | "<n>d ago" | "1w ago" | "2w+ ago", or "" when seenDay is null. */
export function lastSeenLabel(seenDay, today) {
  if (seenDay === null || seenDay === undefined) return "";
  const days = today - seenDay;
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 6) return `${days}d ago`;
  if (days <= 13) return "1w ago";
  return "2w+ ago";
}
