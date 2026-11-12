import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createRunTickets } from "../app/modes/run-ticket";

test("a campaign ticket is asked for its level", async () => {
  const sent = [];
  const tickets = createRunTickets({
    call: async (name, data) => (sent.push([name, data]), { ticket: "t1", seed: data.seed }),
    ensurePlayer: async () => {},
  });
  assert.deepEqual(await tickets.start("campaign", 25, { wait: Infinity }), {
    ticket: "t1",
    seed: 25,
  });
  assert.deepEqual(sent, [["startRun", { mode: "campaign", seed: 25 }]]);
});
