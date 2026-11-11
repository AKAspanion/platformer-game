/**
 * Daily reminders' server logic, free of Firebase so it can be tested on its
 * own (tests/reminders-functions.test.js). index.js wires it to Firestore
 * (pushSubs/{uid}, saves/{uid}) and Firebase Cloud Messaging.
 *
 *   handleSetReminders({ auth, data }, { subs, limiter, now? }) -> { on, devices }
 *   handleSendReminders({ subs, saves, messaging, now?, log? })  -> { sent, skipped, pruned }
 *
 * pushSubs/{uid} = { devices: [{ token, platform, addedAt }], tokens: [token],
 * timeZone, lastSentDay }. `tokens` mirrors `devices` so one device can be
 * found under another account with array-contains.
 */
import { ApiError } from "./handlers.js";
import {
  MAX_DEVICES,
  SETTINGS_LIMIT,
  localTime,
  validTimeZone,
  reminderFor,
  isDue,
} from "../shared/reminders/rules.js";

export const MAX_TOKEN = 4096;
export const PLATFORMS = ["web", "ios"];
export const LINK = "https://dino.spanion.in/?from=reminder";

const BUSY = "Couldn't turn on reminders. Try again later.";

const validToken = (token) =>
  typeof token === "string" && token.length > 0 && token.length <= MAX_TOKEN;

/**
 * Turns the caller's reminders on for a device, or off. `subs`:
 * update(uid, fn) runs fn(current | null) -> the new document, atomically;
 * release(token, uid) removes the token from every other account.
 */
export async function handleSetReminders({ auth, data }, { subs, limiter, now = Date.now }) {
  if (!auth || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to turn on reminders.");
  }
  const body = data && typeof data === "object" ? data : {};
  const on = body.on === true;
  if (!validToken(body.token)) throw new ApiError("invalid-argument", "That device can't get reminders.");
  if (on) {
    if (!PLATFORMS.includes(body.platform)) {
      throw new ApiError("invalid-argument", "That device can't get reminders.");
    }
    if (!validTimeZone(body.timeZone)) {
      throw new ApiError("invalid-argument", "That time zone isn't supported.");
    }
  }
  if (await limiter(auth.uid, "reminders", SETTINGS_LIMIT)) {
    throw new ApiError("resource-exhausted", BUSY);
  }

  const { token } = body;
  if (on) await subs.release(token, auth.uid);
  let devices = 0;
  await subs.update(auth.uid, (current) => {
    const kept = ((current && current.devices) || []).filter((d) => d.token !== token);
    if (on) kept.push({ token, platform: body.platform, addedAt: now() });
    kept.sort((a, b) => a.addedAt - b.addedAt);
    const list = kept.slice(-MAX_DEVICES);
    devices = list.length;
    return {
      devices: list,
      tokens: list.map((d) => d.token),
      timeZone: on ? body.timeZone : (current && current.timeZone) || "UTC",
      lastSentDay: (current && current.lastSentDay) || null,
    };
  });
  return { on, devices };
}

/**
 * One hourly pass over the subscriptions. `subs`: all() async-iterates
 * { uid, devices, timeZone, lastSentDay }, update(uid, patch), claimDay(uid, day)
 * -> true only for the call that stamped lastSentDay; `saves.streak(uid)`;
 * `messaging.send(tokens, { title, body, link })` -> { invalidTokens }.
 */
export async function handleSendReminders({
  subs,
  saves,
  messaging,
  now = Date.now,
  log = () => {},
}) {
  const result = { sent: 0, skipped: 0, pruned: 0 };
  const ms = now();
  for await (const sub of subs.all()) {
    if (!isDue(sub, ms)) continue;
    const devices = Array.isArray(sub.devices) ? sub.devices : [];
    const day = localTime(ms, sub.timeZone).seed;
    let claimed = false;
    try {
      const reminder = reminderFor(await saves.streak(sub.uid), day);
      // claimed before sending so two overlapping passes never both send
      if (!(await subs.claimDay(sub.uid, day))) {
        result.skipped++;
        continue;
      }
      claimed = true;
      if (!reminder || devices.length === 0) {
        claimed = false; // nothing to send: the day stays stamped
        result.skipped++;
        continue;
      }
      const tokens = devices.map((d) => d.token);
      const { invalidTokens } = await messaging.send(tokens, {
        title: reminder.title,
        body: reminder.body,
        link: LINK,
      });
      claimed = false; // delivered: the day stays taken whatever happens next
      result.sent++;
      const dead = new Set((invalidTokens || []).filter((t) => tokens.includes(t)));
      if (dead.size) {
        const left = devices.filter((d) => !dead.has(d.token));
        await subs.update(sub.uid, { devices: left, tokens: left.map((d) => d.token) });
        result.pruned += dead.size;
      }
    } catch (error) {
      log(`reminder failed (${error && error.name}), pass goes on`);
      // a failed send gives the day back so a later hour can retry
      if (claimed) {
        try {
          await subs.update(sub.uid, { lastSentDay: sub.lastSentDay ?? null });
        } catch (releaseError) {
          log(`reminder claim not released (${releaseError && releaseError.name})`);
        }
      }
    }
  }
  return result;
}
