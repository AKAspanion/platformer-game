// An in-memory runs/{ticket} store with the shape functions/index.js builds on Firestore.

let next = 0;
const newId = () => `t${String(++next).padStart(19, "0")}`; // 20 characters, like Firestore ids

export function fakeTickets(initial = {}) {
  const docs = new Map(Object.entries(initial).map(([id, t]) => [id, structuredClone(t)]));
  return {
    docs,
    released: [],
    async create(data) {
      const id = newId();
      docs.set(id, structuredClone(data));
      return id;
    },
    async claim(id, accept) {
      const ticket = docs.has(id) ? structuredClone(docs.get(id)) : null;
      if (!accept(ticket)) return false;
      docs.get(id).used = true;
      return true;
    },
    async release(id) {
      this.released.push(id);
      if (docs.has(id)) docs.get(id).used = false;
    },
  };
}

/**
 * Adds a ticket for this run to `tickets` (started long enough ago for any
 * plausible run) and returns the run's data with it, unless it has one.
 */
export function ticketed(tickets, auth, mode, data, now) {
  if (!data || typeof data !== "object" || Array.isArray(data) || "ticket" in data) return data;
  const id = newId();
  tickets.docs.set(id, {
    uid: auth && auth.uid,
    mode,
    seed: data.seed,
    startedAt: now - 11 * 3600 * 1000,
    expiresAt: now + 86400000,
    used: false,
  });
  return { ...data, ticket: id };
}
