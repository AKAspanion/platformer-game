// GENERATED from app/reminders/rules.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * Daily reminder rules, shared by the game and the functions (synced into
 * functions/shared/ by scripts/sync-functions-shared.js). Pure: no browser
 * globals, no Firebase.
 */
import { daysBetween, seedToDate } from "../daily/rules.js";

/** The local hour a reminder goes out. */
export const REMINDER_HOUR = 18;
/** Devices kept per account; adding one more drops the oldest. */
export const MAX_DEVICES = 5;
/** Reminder-setting changes allowed per account per hour. */
export const SETTINGS_LIMIT = 30;
export const TITLE = "Dino's Adventure";

const formatters = new Map();

/** A cached formatter for the zone, or null when Intl rejects it. */
function formatterFor(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return null;
  if (formatters.has(timeZone)) return formatters.get(timeZone);
  let formatter = null;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
    });
  } catch {
    formatter = null;
  }
  formatters.set(timeZone, formatter);
  return formatter;
}

/** True for an IANA time zone name this runtime knows. */
export function validTimeZone(timeZone) {
  return formatterFor(timeZone) !== null;
}

/** The local date as a seed (20261111) and the local hour (0-23) at `ms` in `timeZone`; null for an unknown zone. */
export function localTime(ms, timeZone) {
  const formatter = formatterFor(timeZone);
  if (!formatter || !Number.isFinite(ms)) return null;
  let parts;
  try {
    parts = formatter.formatToParts(new Date(ms));
  } catch {
    return null;
  }
  const part = (type) => Number(parts.find((p) => p.type === type)?.value);
  const seed = part("year") * 10000 + part("month") * 100 + part("day");
  const hour = part("hour") % 24;
  if (!Number.isInteger(seed) || !Number.isInteger(hour)) return null;
  return { seed, hour };
}

/** Whether the streak still stands today: last day yesterday, or the day before with a freeze left. */
function streakAlive(streak, todaySeed) {
  const gap = daysBetween(streak.last, todaySeed);
  if (gap === 1) return true;
  return gap === 2 && Number.isInteger(streak.freezes) && streak.freezes >= 1;
}

/** Which reminder a player gets today, from their cloud-saved streak, or null when they already played. */
export function reminderFor(streak, todaySeed) {
  const valid = streak && typeof streak === "object" && seedToDate(streak.last);
  if (valid && streak.last === todaySeed) return null;
  if (valid && Number.isInteger(streak.days) && streak.days >= 2 && streakAlive(streak, todaySeed)) {
    return {
      kind: "streak",
      title: TITLE,
      body: `Your ${streak.days}-day streak ends tonight. Play today's challenge to keep it.`,
      days: streak.days,
    };
  }
  return { kind: "daily", title: TITLE, body: "Today's challenge is up. 5 new levels are waiting." };
}

/** True when a reminder is due at `ms`: the local hour is REMINDER_HOUR and nothing was sent on this local day. */
export function isDue(sub, ms) {
  const local = localTime(ms, sub && sub.timeZone);
  if (!local || local.hour !== REMINDER_HOUR) return false;
  return sub.lastSentDay !== local.seed;
}
