/**
 * getProfiles: the leaderboard looks of up to 30 players, free of Firebase so
 * it can be tested on its own (tests/profiles-functions.test.js). index.js
 * wires it to Firestore.
 *
 *   handleGetProfiles({ auth, data: { uids } }, { profiles })
 *     -> { [uid]: { skin, hat, companion, seenDay? } }
 *
 * `profiles` (Firestore: players/{uid}, which no client may read):
 *   getAll(uids) -> [{ uid, data }] for each uid that has a document
 *
 * Clients never read players/{uid} themselves: Firestore gives every reader a
 * document's create and update times, to the microsecond, which would show the
 * time of day each player played. This hands out only the four profile fields,
 * cleaned like the game cleans them, and a uid with no profile is left out. It
 * never writes. Everything in the request is untrusted.
 */
import { PROFILE_BATCH, publicProfile } from "../shared/profiles/rules.js";
import { ApiError } from "./handlers.js";

/** Firebase Auth's longest uid. */
export const MAX_UID = 128;

// a uid that is also a usable document id: no path, no dot names, no __reserved__ id
const isUid = (uid) =>
  typeof uid === "string" &&
  uid.length > 0 &&
  uid.length <= MAX_UID &&
  !uid.includes("/") &&
  uid !== "." &&
  uid !== ".." &&
  !/^__.*__$/.test(uid);

/** The request's uids, or null unless it is 1 to PROFILE_BATCH distinct valid ones. */
function requestedUids(data) {
  const uids = data && typeof data === "object" && !Array.isArray(data) ? data.uids : undefined;
  if (!Array.isArray(uids) || uids.length < 1 || uids.length > PROFILE_BATCH) return null;
  for (let i = 0; i < uids.length; i++) if (!isUid(uids[i])) return null;
  return new Set(uids).size === uids.length ? uids : null;
}

export async function handleGetProfiles({ auth, data }, { profiles }) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    throw new ApiError("unauthenticated", "Sign in to see the leaderboard.");
  }
  const uids = requestedUids(data);
  if (!uids) {
    throw new ApiError("invalid-argument", `Ask for 1 to ${PROFILE_BATCH} different players.`);
  }
  const wanted = new Set(uids);
  const found = [];
  for (const row of await profiles.getAll(uids)) {
    if (!row || !wanted.has(row.uid)) continue;
    const profile = publicProfile(row.data);
    if (profile) found.push([row.uid, profile]);
  }
  return Object.fromEntries(found);
}
