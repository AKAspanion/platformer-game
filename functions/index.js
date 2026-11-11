/**
 * Cloud Functions for Dino's Adventure's world creator (region asia-south1,
 * next to the Firestore database).
 *
 *   designWorld({ prompt })  -> { spec }    Claude turns a prompt into a world spec
 *   publishWorld({ world })  -> { world }   validates a world and shares it in Firestore
 *   searchWorlds({ query })  -> { worlds }  every shared world matching a search
 *   submitDailyScore({ seed, score, seconds })
 *                            -> { rank, total, best, improved }  the daily challenge's leaderboard
 *   deleteAccount()          -> { worlds }  deletes the caller; their worlds become "Anonymous",
 *                                           their daily scores are deleted
 *
 * All are callable functions: the Firebase SDK in the game sends the
 * player's ID token, so request.auth is the verified user (or null).
 * Players read the shared worlds straight from Firestore (see firestore.rules);
 * only these functions write them.
 *
 * Config:
 *   ANTHROPIC_API_KEY  secret:  firebase functions:secrets:set ANTHROPIC_API_KEY
 *   WORLD_MODEL        optional, functions/.env  (default claude-haiku-5-5)
 */
import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  ApiError,
  handleDesign,
  handlePublish,
  handleSearch,
  handleDeleteAccount,
  overLimit,
} from "./src/handlers.js";
import { handleSubmitDaily, outranks } from "./src/daily.js";
import { createDesigner, Anthropic } from "./src/designer.js";

// invoker "public": anyone may reach the functions (the game calls them from the
// browser); each one checks request.auth itself. Stated explicitly so every
// deploy applies it, not only the one that first creates a function.
setGlobalOptions({ region: "asia-south1", maxInstances: 10, invoker: "public" });

initializeApp();
const db = getFirestore();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
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
  async create(world) {
    try {
      await db.collection("worlds").doc(world.id).create(world);
    } catch (error) {
      if (error.code === 6) throw new ApiError("already-exists", "That world is already shared.");
      throw error;
    }
  },
};

/** ApiError -> HttpsError (shown to the player); anything else is logged. */
const callable = (options, handler) =>
  onCall(options, async (request) => {
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
  handlePublish(request, { store, limiter }),
);

// Firestore can't search text, so search reads every world, at most once per
// two minutes per instance: a search costs nothing more than a cache hit.
const SEARCH_CACHE_MS = 120000;
let everyWorld = null;
const allWorlds = async () => {
  if (everyWorld && Date.now() - everyWorld.at < SEARCH_CACHE_MS) return everyWorld.list;
  const snap = await db.collection("worlds").orderBy("createdAt", "desc").get();
  everyWorld = { at: Date.now(), list: snap.docs.map((d) => d.data()) };
  return everyWorld.list;
};

export const searchWorlds = callable({ timeoutSeconds: 30 }, (request) =>
  handleSearch(request, { allWorlds }),
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

export const submitDailyScore = callable({ timeoutSeconds: 20 }, (request) =>
  handleSubmitDaily(request, { scores, limiter }),
);

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
  async deleteDailyScores(uid) {
    for (;;) {
      const snap = await db.collectionGroup("scores").where("uid", "==", uid).limit(400).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  },
  async deleteSave(uid) {
    await db.collection("saves").doc(uid).delete();
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
