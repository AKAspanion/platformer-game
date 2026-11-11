/**
 * The community worlds this device has started, so their cards can be highlighted.
 * Kept in localStorage key "played_worlds" as a list of world ids, newest last,
 * at most MAX_PLAYED; a blocked or corrupt store reads as empty and never throws.
 *
 *   const played = createPlayed();
 *   played.mark(world.id);
 *   played.has(world.id) -> true
 */
export const MAX_PLAYED = 500;
const KEY = "played_worlds";

const defaultStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
};

export function createPlayed(storage = defaultStorage()) {
  const read = () => {
    try {
      const list = JSON.parse(storage.getItem(KEY));
      return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
    } catch (error) {
      return [];
    }
  };
  return {
    mark(worldId) {
      if (typeof worldId !== "string" || !worldId) return;
      const list = read().filter((id) => id !== worldId);
      list.push(worldId);
      try {
        storage.setItem(KEY, JSON.stringify(list.slice(-MAX_PLAYED)));
      } catch (error) {
        // storage full or blocked: the card just isn't highlighted
      }
    },
    has(worldId) {
      return read().includes(worldId);
    },
  };
}
