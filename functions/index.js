/**
 * Cloud Functions for Dino's Adventure's world creator (region asia-south1,
 * next to the Firestore database).
 *
 *   designWorld({ prompt })  -> { spec }    Claude turns a prompt into a world spec
 *   publishWorld({ world })  -> { world }   validates a world and shares it in Firestore
 *
 * Both are callable functions: the Firebase SDK in the game sends the
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
import { ApiError, handleDesign, handlePublish, overLimit } from "./src/handlers.js";
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
