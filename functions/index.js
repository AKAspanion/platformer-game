/**
 * Cloud Functions for Dino's Adventure's world creator (region asia-south1,
 * next to the Firestore database).
 *
 *   designWorld({ prompt })  -> { spec }    Claude turns a prompt into a world spec
 *   publishWorld({ world })  -> { world }   validates a world and shares it in Firestore
 *   searchWorlds({ query })  -> { worlds }  every shared world matching a search
 *   startRun({ mode, seed? })  -> { ticket, seed, startedAt }  a ranked daily or endless run
 *                                           begins (the server picks endless seeds)
 *   submitDailyScore({ seed, score, seconds, ticket })
 *                            -> { rank, total, best, improved }  the daily challenge's leaderboard
 *   submitEndlessScore({ seed, level, score, seconds, ticket })
 *                            -> { rank, total, best, improved }  the endless mode's leaderboard
 *   recordWorldPlay({ worldId, kind }) -> { counted }   a play or finish, once per account per day
 *   toggleWorldLike({ worldId })       -> { liked, likes }
 *   pickWorldOfWeek                    scheduled, Mondays 00:00 UTC
 *   worldPage                          /w/<id> link previews and /w/<id>/thumb.png (HTTP)
 *   setReminders({ on, token, platform, timeZone })
 *                            -> { on, devices }  turns the daily reminder on or off for a device
 *   sendReminders            scheduled hourly; sends the 18:00 local reminder
 *   deleteAccount()          -> { worlds }  deletes the caller; their worlds become "Anonymous",
 *                                           their daily scores, endless entry, save and
 *                                           reminders are deleted
 *
 * All are callable functions: the Firebase SDK in the game sends the
 * player's ID token, so request.auth is the verified user (or null).
 * Players read the shared worlds straight from Firestore (see firestore.rules);
 * only these functions write them.
 *
 * Config:
 *   ANTHROPIC_API_KEY  secret:  firebase functions:secrets:set ANTHROPIC_API_KEY
 *   WORLD_MODEL        optional, functions/.env  (default claude-haiku-5-5)
 *   APP_CHECK_ENFORCE  functions/.env: false = monitor (calls without a valid App
 *                      Check token are logged), true = refused. See functions/README.md.
 */
import { setGlobalOptions } from "firebase-functions";
import { onCall, onRequest, HttpsError } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { defineSecret, defineBoolean } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import {
  ApiError,
  handleDesign,
  handlePublish,
  handleSearch,
  handleDeleteAccount,
  overLimit,
} from "./src/handlers.js";
import {
  handleRecordPlay,
  handleToggleLike,
  handlePickFeatured,
  handleWorldPage,
} from "./src/community.js";
import { sanitizeWorld } from "./shared/spec.js";
import { worldLink } from "./shared/worlds/community.js";
import { handleSubmitDaily, outranks } from "./src/daily.js";
import { handleSetReminders, handleSendReminders } from "./src/reminders.js";
import { handleSubmitEndless } from "./src/endless.js";
import { handleStartRun } from "./src/runs.js";
import { compareRuns } from "./shared/modes/endless-rules.js";
import { createDesigner, Anthropic } from "./src/designer.js";

// invoker "public": anyone may reach the functions (the game calls them from the
// browser); each one checks request.auth itself. Stated explicitly so every
// deploy applies it, not only the one that first creates a function.
setGlobalOptions({ region: "asia-south1", maxInstances: 10, invoker: "public" });

initializeApp();
const db = getFirestore();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const APP_CHECK_ENFORCE = defineBoolean("APP_CHECK_ENFORCE", {
  default: false,
  description: "Refuse callable requests without a valid App Check token",
});
const MODEL = process.env.WORLD_MODEL || "claude-haiku-5-5";

const limiter = (uid, kind, max) =>
  db.runTransaction(async (transaction) => {
    const ref = db.collection("limits").doc(uid);
    const tx = {
      get: async () => {
        const snap = await transaction.get(ref);
        return snap.exists ? snap.data() : null;
      },
      set: (_, patch) => transaction.set(ref, patch, { merge: true }),
    };
    return overLimit(tx, uid, kind, max);
  });

const store = {
  async create(world, thumb) {
    try {
      // the world and its thumbnail land together or not at all
      const batch = db.batch();
      batch.create(db.collection("worlds").doc(world.id), world);
      if (thumb) {
        batch.create(db.collection("thumbs").doc(world.id), {
          png: thumb.toString("base64"),
          bytes: thumb.length,
        });
      }
      await batch.commit();
    } catch (error) {
      if (error.code === 6) throw new ApiError("already-exists", "That world is already shared.");
      throw error;
    }
  },
};

/**
 * Every callable: App Check per APP_CHECK_ENFORCE (monitor mode logs calls
 * without a valid token, so the rollout can be watched before enforcing);
 * ApiError -> HttpsError (shown to the player); anything else is logged.
 */
const callable = (options, handler) =>
  onCall({ enforceAppCheck: APP_CHECK_ENFORCE, ...options }, async (request) => {
    if (!request.app) logger.info("call without App Check", { appCheck: "missing" });
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ApiError) throw new HttpsError(error.code, error.message);
      if (error instanceof Anthropic.RateLimitError) {
        throw new HttpsError("unavailable", "The world designer is busy, try again in a minute.");
      }
      if (error instanceof Anthropic.APIError) {
        logger.error(`Claude API error ${error.status}: ${error.message}`);
        throw new HttpsError("unavailable", "The world designer is unavailable right now.");
      }
      logger.error(error);
      throw new HttpsError("internal", "Something went wrong.");
    }
  });

let designer = null;

export const designWorld = callable(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    if (!designer) designer = createDesigner({ apiKey: ANTHROPIC_API_KEY.value(), model: MODEL });
    const design = async (prompt) => {
      const result = await designer(prompt);
      if (result.spec) {
        const { input_tokens: inTokens, output_tokens: outTokens } = result.usage || {};
        logger.info(`world "${result.spec.name}" in=${inTokens} out=${outTokens}`, {
          uid: request.auth && request.auth.uid,
        });
      }
      return result;
    };
    return handleDesign(request, { design, limiter });
  },
);

export const publishWorld = callable({ timeoutSeconds: 20 }, (request) =>
  handlePublish(request, { store, limiter, log: (message) => logger.info(message) }),
);

// Firestore can't search text, so search matches against the newest worlds'
// searchable fields only (a field mask: no specs or thumbnails), cached two
// minutes per instance, then reads the few full worlds it returns.
const SEARCH_CACHE_MS = 120000;
const SEARCH_SCAN_LIMIT = 5000;
const SEARCH_FIELDS = ["id", "name", "tagline", "author", "createdAt", "spec.boss.name"];
let everyWorld = null;
const allWorlds = async () => {
  if (everyWorld && Date.now() - everyWorld.at < SEARCH_CACHE_MS) return everyWorld.list;
  const snap = await db
    .collection("worlds")
    .orderBy("createdAt", "desc")
    .limit(SEARCH_SCAN_LIMIT)
    .select(...SEARCH_FIELDS)
    .get();
  everyWorld = { at: Date.now(), list: snap.docs.map((d) => ({ ...d.data(), id: d.id })) };
  return everyWorld.list;
};
const worldsByIds = async (ids) => {
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => db.collection("worlds").doc(id)));
  return snaps.filter((s) => s.exists).map((s) => s.data());
};

export const searchWorlds = callable({ timeoutSeconds: 30 }, (request) =>
  handleSearch(request, { allWorlds, worldsByIds }),
);

// daily/{seed}/scores/{uid}: one best run per player per day
const scoresOf = (seed) => db.collection("daily").doc(String(seed)).collection("scores");
const countOf = async (query) => (await query.count().get()).data().count;

const scores = {
  async get(seed, uid) {
    const snap = await scoresOf(seed).doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  // keeps the better run if two submissions race: a worse one never overwrites
  async set(seed, uid, entry) {
    const ref = scoresOf(seed).doc(uid);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists || outranks(entry, snap.data())) transaction.set(ref, entry);
    });
  },
  async rankOf(seed, entry) {
    const day = scoresOf(seed);
    const [higher, faster] = await Promise.all([
      countOf(day.where("score", ">", entry.score)),
      countOf(day.where("score", "==", entry.score).where("seconds", "<", entry.seconds)),
    ]);
    return higher + faster + 1;
  },
  count: (seed) => countOf(scoresOf(seed)),
};

// runs/{ticket}: one per ranked run, closed to clients; a TTL policy on
// expireAt deletes old ones (firestore.indexes.json)
const runsOf = () => db.collection("runs");

const tickets = {
  async create(data) {
    const ref = runsOf().doc();
    await ref.create(data);
    return ref.id;
  },
  claim: (id, accept) =>
    db.runTransaction(async (transaction) => {
      const ref = runsOf().doc(id);
      const snap = await transaction.get(ref);
      if (!accept(snap.exists ? snap.data() : null)) return false;
      transaction.update(ref, { used: true, usedAt: Date.now() });
      return true;
    }),
  async release(id) {
    await runsOf().doc(id).update({ used: false, usedAt: null });
  },
};

export const startRun = callable({ timeoutSeconds: 15 }, (request) =>
  handleStartRun(request, { tickets, limiter }),
);

export const submitDailyScore = callable({ timeoutSeconds: 20 }, (request) =>
  handleSubmitDaily(request, { scores, tickets, limiter }),
);

// endless/{uid}: one best run per player, ever
const endlessBoard = db.collection("endless");

const board = {
  async get(uid) {
    const snap = await endlessBoard.doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  // keeps the better run if two submissions race: a worse one never overwrites
  async set(uid, entry) {
    const ref = endlessBoard.doc(uid);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists || compareRuns(entry, snap.data()) < 0) transaction.set(ref, entry);
    });
  },
  async rankOf(entry) {
    const [higher, better, faster] = await Promise.all([
      countOf(endlessBoard.where("level", ">", entry.level)),
      countOf(endlessBoard.where("level", "==", entry.level).where("score", ">", entry.score)),
      countOf(
        endlessBoard
          .where("level", "==", entry.level)
          .where("score", "==", entry.score)
          .where("seconds", "<", entry.seconds),
      ),
    ]);
    return higher + better + faster + 1;
  },
  count: () => countOf(endlessBoard),
};

export const submitEndlessScore = callable({ timeoutSeconds: 20 }, (request) =>
  handleSubmitEndless(request, { board, tickets, limiter }),
);

/** Deletes every document `query` matches, 400 per batch. */
async function deleteAll(query) {
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

const accounts = {
  async anonymizeWorlds(uid, author) {
    const snap = await db.collection("worlds").where("author.uid", "==", uid).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { author }));
      await batch.commit();
    }
    everyWorld = null;
    return snap.size;
  },
  deleteDailyScores: (uid) => deleteAll(db.collectionGroup("scores").where("uid", "==", uid)),
  deleteLikes: (uid) => deleteAll(db.collection("worldLikes").where("uid", "==", uid)),
  deleteRuns: (uid) => deleteAll(db.collection("runs").where("uid", "==", uid)),
  // markers written before they carried a uid hold no account name; TTL removes new ones
  deleteSeen: (uid) => deleteAll(db.collectionGroup("seen").where("uid", "==", uid)),
  async deleteEndless(uid) {
    await endlessBoard.doc(uid).delete();
  },
  async deleteSave(uid) {
    await db.collection("saves").doc(uid).delete();
  },
  async deleteReminders(uid) {
    await db.collection("pushSubs").doc(uid).delete();
  },
  async deleteData(uid) {
    await db.collection("limits").doc(uid).delete();
  },
  async deleteUser(uid) {
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  },
};

export const deleteAccount = callable({ timeoutSeconds: 60 }, async (request) => {
  const result = await handleDeleteAccount(request, { accounts });
  logger.info(`account deleted, ${result.worlds} worlds now anonymous`, { uid: request.auth.uid });
  return result;
});

// ---------------------------------------------------------------- community

/** Firestore transaction adapter: paths like "worldStats/<id>/days/<day>". */
const stats = {
  transaction: (fn) =>
    db.runTransaction((transaction) =>
      fn({
        get: async (path) => {
          const snap = await transaction.get(db.doc(path));
          return snap.exists ? snap.data() : null;
        },
        set: (path, data) => transaction.set(db.doc(path), data),
        delete: (path) => transaction.delete(db.doc(path)),
      }),
    ),
  // the busiest worlds by trend, with when each was made
  async top(limit) {
    const snap = await db.collection("worldStats").orderBy("trend", "desc").limit(limit).get();
    if (snap.empty) return [];
    const worlds = await db.getAll(...snap.docs.map((d) => db.collection("worlds").doc(d.id)), {
      fieldMask: ["createdAt"],
    });
    return worlds.filter((w) => w.exists).map((w) => ({ id: w.id, createdAt: w.get("createdAt") }));
  },
  async daysOf(id, sinceDay) {
    const snap = await db
      .collection("worldStats")
      .doc(id)
      .collection("days")
      .where(FieldPath.documentId(), ">=", sinceDay)
      .get();
    return snap.docs.map((d) => ({ day: d.id, ...d.data() }));
  },
};

const worlds = {
  async exists(id) {
    return (await db.collection("worlds").doc(id).get()).exists;
  },
};

export const recordWorldPlay = callable({ timeoutSeconds: 15 }, (request) =>
  handleRecordPlay(request, { stats, limiter }),
);

export const toggleWorldLike = callable({ timeoutSeconds: 15 }, (request) =>
  handleToggleLike(request, { stats, worlds, limiter }),
);

const featuredDoc = db.collection("config").doc("featured");

export const pickWorldOfWeek = onSchedule(
  { schedule: "every monday 00:00", timeZone: "UTC", timeoutSeconds: 300 },
  async () => {
    const config = {
      get: async () => {
        const snap = await featuredDoc.get();
        return snap.exists ? snap.data() : null;
      },
      // merge: keeps the hand-set worldId
      set: (patch) => featuredDoc.set(patch, { merge: true }),
    };
    const picked = await handlePickFeatured({ stats, config });
    logger.info(`world of the week: ${picked}`);
  },
);

const ORIGIN = new URL(worldLink("x")).origin;

/** /w/<id> (link previews, then into the game) and /w/<id>/thumb.png. */
export const worldPage = onRequest({ timeoutSeconds: 15 }, async (req, res) => {
  try {
    const page = await handleWorldPage(req.path, req.method, {
      origin: ORIGIN,
      async getWorld(id) {
        const snap = await db.collection("worlds").doc(id).get();
        return snap.exists ? sanitizeWorld(snap.data()) : null;
      },
      async getThumb(id) {
        const snap = await db.collection("thumbs").doc(id).get();
        return snap.exists ? Buffer.from(String(snap.get("png")), "base64") : null;
      },
    });
    res
      .status(page.status)
      .set({
        "Cache-Control": page.cacheControl,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
      })
      .type(page.type)
      .send(page.body);
  } catch (error) {
    logger.error(error);
    res.status(500).type("text").send("Something went wrong.");
  }
});

// ---------------------------------------------------------------- reminders

// pushSubs/{uid} = { devices, tokens, timeZone, lastSentDay }: closed to clients
// (firestore.rules), written only here. `tokens` mirrors the devices so a token
// can be found under another account with a single-field array-contains query
// (automatic index, nothing to add to firestore.indexes.json).
const subsOf = () => db.collection("pushSubs");
const SUBS_PAGE = 300;

const reminderSubs = {
  // runs fn(current | null) -> the new document (null: leave it) in one transaction
  update: (uid, change) =>
    db.runTransaction(async (transaction) => {
      const ref = subsOf().doc(uid);
      if (typeof change !== "function") {
        transaction.set(ref, change, { merge: true });
        return;
      }
      const snap = await transaction.get(ref);
      const next = change(snap.exists ? snap.data() : null);
      if (next) transaction.set(ref, next);
    }),
  // one device belongs to one account: drop the token from every other one
  async release(token, uid) {
    const snap = await subsOf().where("tokens", "array-contains", token).get();
    await Promise.all(
      snap.docs
        .filter((d) => d.id !== uid)
        .map((d) =>
          db.runTransaction(async (transaction) => {
            const fresh = await transaction.get(d.ref);
            if (!fresh.exists) return;
            const devices = (fresh.get("devices") || []).filter((x) => x.token !== token);
            transaction.update(d.ref, { devices, tokens: devices.map((x) => x.token) });
          }),
        ),
    );
  },
  // every subscription, a page at a time
  async *all() {
    let last = null;
    for (;;) {
      let query = subsOf().orderBy(FieldPath.documentId()).limit(SUBS_PAGE);
      if (last) query = query.startAfter(last);
      const snap = await query.get();
      if (snap.empty) return;
      for (const d of snap.docs) yield { uid: d.id, ...d.data() };
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < SUBS_PAGE) return;
    }
  },
  // true only for the call that sets lastSentDay to `day`: the transaction
  // makes two overlapping passes agree on who sends
  claimDay: (uid, day) =>
    db.runTransaction(async (transaction) => {
      const ref = subsOf().doc(uid);
      const snap = await transaction.get(ref);
      if (!snap.exists || snap.get("lastSentDay") === day) return false;
      transaction.update(ref, { lastSentDay: day });
      return true;
    }),
};

export const setReminders = callable({ timeoutSeconds: 15 }, (request) =>
  handleSetReminders(request, { subs: reminderSubs, limiter }),
);

const DEAD_TOKEN = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);
const ICON = "https://dino.spanion.in/images/icons-192.png";

const messaging = {
  // one multicast carries both a web and an iOS payload: each device reads its own
  async send(tokens, { title, body, link }) {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { notification: { title, body, icon: ICON }, fcmOptions: { link } },
      apns: { payload: { aps: { alert: { title, body }, sound: "default" } } },
    });
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error && DEAD_TOKEN.has(r.error.code)) invalidTokens.push(tokens[i]);
    });
    if (response.successCount === 0 && invalidTokens.length < tokens.length) {
      throw new Error("reminder not delivered to any device");
    }
    return { invalidTokens };
  },
};

const saves = {
  async streak(uid) {
    const snap = await db.collection("saves").doc(uid).get();
    const streak = snap.exists ? snap.get("data.streak") : null;
    return streak && typeof streak === "object" ? streak : null;
  },
};

export const sendReminders = onSchedule(
  { schedule: "every 1 hours", timeZone: "UTC", timeoutSeconds: 300 },
  async () => {
    const result = await handleSendReminders({
      subs: reminderSubs,
      saves,
      messaging,
      log: (message) => logger.warn(message),
    });
    logger.info(
      `reminders: ${result.sent} sent, ${result.skipped} skipped, ${result.pruned} devices removed`,
    );
  },
);
