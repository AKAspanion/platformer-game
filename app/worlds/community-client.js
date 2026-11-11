import { firestoreCommunity } from "../firebase/community.js";
import { auth } from "../auth/index.js";
import { TRENDING_LIMIT, dayKey, isBuiltIn } from "./community.js";

/**
 * What the community does with a world: plays, likes, trending, the world of
 * the week and a creator's last 7 days.
 *
 *   community.recordPlay(worldId, "play" | "finish")  never throws; built-in worlds are skipped
 *   community.toggleLike(worldId)                      -> { liked, likes }; throws the server's message
 *   community.stats(ids)                               -> { [id]: { plays, finishes, likes } }
 *   community.trending()                               -> world ids, best first
 *   community.featured()                               -> world id | null
 *   community.liked(ids)                               -> Set of the ids this player liked
 *   community.myWeek(worldIds)                         -> { plays, finishes, likes, perWorld }
 *
 * `backend` (app/firebase/community.js in the game) does the calls and reads.
 * Counts are kept by the server; the game never writes them. Built-in worlds
 * have no counts, so none of this touches them.
 */

const DAYS = 7;
const DAY_MS = 86400000;

const zero = () => ({ plays: 0, finishes: 0, likes: 0 });
const count = (n) => Math.max(0, Math.floor(Number(n) || 0));
const clean = (c) => ({
  plays: count(c && c.plays),
  finishes: count(c && c.finishes),
  likes: count(c && c.likes),
});
/** Each community world once, in order. */
const communityIds = (ids) => [...new Set((ids || []).filter((id) => id && !isBuiltIn(id)))];

export function createCommunity(backend, { ensurePlayer, now = Date.now }) {
  return {
    async recordPlay(worldId, kind) {
      if (!worldId || isBuiltIn(worldId)) return;
      try {
        await ensurePlayer();
        await backend.call("recordWorldPlay", { worldId, kind });
      } catch (error) {
        // offline or over the limit: a missed count must never interrupt play
      }
    },

    async toggleLike(worldId) {
      await ensurePlayer();
      const result = await backend.call("toggleWorldLike", { worldId });
      return { liked: Boolean(result && result.liked), likes: count(result && result.likes) };
    },

    async stats(ids) {
      const wanted = communityIds(ids);
      if (!wanted.length) return {};
      const found = (await backend.stats(wanted)) || {};
      const own = (id) => (Object.hasOwn(found, id) ? clean(found[id]) : zero());
      return Object.fromEntries(wanted.map((id) => [id, own(id)]));
    },

    async trending() {
      const ids = (await backend.trending(TRENDING_LIMIT)) || [];
      return ids.filter((id) => !isBuiltIn(id)).slice(0, TRENDING_LIMIT);
    },

    async featured() {
      const id = await backend.featured();
      return id && !isBuiltIn(id) ? id : null;
    },

    async liked(ids) {
      const wanted = communityIds(ids);
      if (!wanted.length) return new Set();
      const { uid } = await ensurePlayer();
      return backend.likedBy(uid, wanted);
    },

    async myWeek(worldIds) {
      const wanted = communityIds(worldIds);
      const total = { ...zero(), perWorld: {} };
      if (!wanted.length) return total;
      const today = now();
      const days = Array.from({ length: DAYS }, (_, i) => dayKey(today - (DAYS - 1 - i) * DAY_MS));
      const found = (await backend.week(wanted, days)) || {};
      wanted.forEach((id) => {
        const c = Object.hasOwn(found, id) ? clean(found[id]) : zero();
        total.perWorld[id] = c;
        total.plays += c.plays;
        total.finishes += c.finishes;
        total.likes += c.likes;
      });
      return total;
    },
  };
}

export const community = createCommunity(firestoreCommunity, {
  ensurePlayer: () => auth.ensurePlayer(),
});
