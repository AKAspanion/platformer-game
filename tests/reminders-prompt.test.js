import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createPrompt } from "../app/reminders/prompt";

const memory = (initial) => {
  const data = new Map(initial === undefined ? [] : [["reminder_prompt", initial]]);
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
};

test("a fresh store asks; either answer stops it, and it stays stopped after a reload", () => {
  for (const yes of [true, false]) {
    const storage = memory();
    const prompt = createPrompt(storage);
    assert.equal(prompt.shouldAsk(), true);
    prompt.answer(yes);
    assert.equal(prompt.shouldAsk(), false);
    assert.equal(createPrompt(storage).shouldAsk(), false);
  }
});

test("a corrupt value doesn't throw and counts as not answered", () => {
  for (const bad of ["{", "null", "[]", "\"x\"", ""]) {
    assert.doesNotThrow(() => createPrompt(memory(bad)).shouldAsk());
    assert.equal(createPrompt(memory(bad)).shouldAsk(), true, bad);
  }
});

test("blocked storage doesn't throw", () => {
  const blocked = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  const prompt = createPrompt(blocked);
  assert.doesNotThrow(() => prompt.shouldAsk());
  assert.doesNotThrow(() => prompt.answer(true));
});

test("the answer is stored as yes or no", () => {
  const storage = memory();
  createPrompt(storage).answer(false);
  assert.equal(JSON.parse(storage.getItem("reminder_prompt")).answer, "no");
  const other = memory();
  createPrompt(other).answer(true);
  assert.equal(JSON.parse(other.getItem("reminder_prompt")).answer, "yes");
});
