import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMS,
  createRecorder,
  encodeGhost,
  decodeGhost,
  createGhostStore,
  ghostAt,
  MAX_SECONDS,
} from "../app/ghosts/ghost";

const memoryStorage = () => {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
};

const ghostOf = (levelId, seconds, n = 3) => ({
  levelId,
  seconds,
  samples: Array.from({ length: n }, (_, i) => ({
    x: 10 + i * 3.4,
    y: -2 + i,
    anim: ANIMS[i % ANIMS.length],
    frame: i % 7,
  })),
});

test("recorder keeps every second tick", () => {
  const r = createRecorder();
  for (let t = 0; t < 10; t++) r.sample(t, { x: t, y: 0, anim: "idleRight", frame: 0 });
  const g = r.finish(1, 0.33);
  assert.equal(g.samples.length, 5);
  assert.deepEqual(
    g.samples.map((s) => s.x),
    [0, 2, 4, 6, 8],
  );
});

test("recorder limits", () => {
  const r = createRecorder();
  assert.equal(r.finish(1, 5), null);
  r.sample(0, { x: 0, y: 0, anim: "idleRight", frame: 0 });
  assert.ok(r.finish(1, MAX_SECONDS));
  assert.equal(r.finish(1, MAX_SECONDS + 1), null);
  r.reset();
  assert.equal(r.finish(1, 5), null);
});

test("encode and decode round trip", () => {
  const g = ghostOf(3, 41.27, 20);
  const back = decodeGhost(encodeGhost(g));
  assert.equal(back.levelId, 3);
  assert.equal(back.seconds, 41.27);
  back.samples.forEach((s, i) => {
    assert.ok(Math.abs(s.x - g.samples[i].x) <= 1);
    assert.ok(Math.abs(s.y - g.samples[i].y) <= 1);
    assert.equal(s.anim, g.samples[i].anim);
    assert.equal(s.frame, g.samples[i].frame);
  });
});

test("a 120 second ghost stays small", () => {
  assert.ok(encodeGhost(ghostOf(1, 120, 1800)).length < 20000);
});

test("malformed ghosts decode to null", () => {
  const good = encodeGhost(ghostOf(1, 10));
  assert.equal(decodeGhost(""), null);
  assert.equal(decodeGhost("not a ghost"), null);
  assert.equal(decodeGhost(null), null);
  assert.equal(decodeGhost(good.slice(0, -6)), null);
  const parts = good.split("|");
  parts[3] = "1";
  parts[4] = btoa(String.fromCharCode(1, 0, 1, 0, 200, 0));
  assert.equal(decodeGhost(parts.join("|")), null);
});

test("store keeps the faster run only", () => {
  const store = createGhostStore(memoryStorage());
  assert.equal(store.get(1), null);
  assert.equal(store.offer(ghostOf(1, 40)), true);
  assert.equal(store.get(1).seconds, 40);
  assert.equal(store.offer(ghostOf(1, 45)), false);
  assert.equal(store.get(1).seconds, 40);
  assert.equal(store.offer(ghostOf(1, 38)), true);
  assert.equal(store.get(1).seconds, 38);
});

test("a corrupt value reads as none and is overwritten", () => {
  const s = memoryStorage();
  s.setItem("ghost_1", "garbage");
  const store = createGhostStore(s);
  assert.equal(store.get(1), null);
  assert.equal(store.offer(ghostOf(1, 90)), true);
  assert.equal(store.get(1).seconds, 90);
});

test("full or blocked storage does not throw", () => {
  const s = memoryStorage();
  s.setItem = () => {
    throw new Error("quota");
  };
  const store = createGhostStore(s);
  assert.equal(store.offer(ghostOf(1, 40)), false);
  const fail = () => {
    throw new Error("blocked");
  };
  const blocked = createGhostStore({ getItem: fail, setItem: fail, removeItem: fail });
  assert.equal(blocked.get(1), null);
  assert.doesNotThrow(() => blocked.clearAll());
});

test("clearAll erases ghosts only", () => {
  const s = memoryStorage();
  const store = createGhostStore(s);
  store.offer(ghostOf(1, 40));
  store.offer(ghostOf(7, 50));
  s.setItem("campaign", "{}");
  store.clearAll();
  assert.equal(store.get(1), null);
  assert.equal(store.get(7), null);
  assert.equal(s.getItem("campaign"), "{}");
});

test("ghostAt interpolates and ends", () => {
  const g = {
    levelId: 1,
    seconds: 1,
    samples: [
      { x: 10, y: 0, anim: "runRight", frame: 2 },
      { x: 14, y: 4, anim: "idleRight", frame: 0 },
    ],
  };
  const mid = ghostAt(g, 1);
  assert.equal(mid.x, 12);
  assert.equal(mid.y, 2);
  assert.equal(mid.anim, "runRight");
  assert.equal(mid.frame, 2);
  assert.equal(ghostAt(g, 2).x, 14);
  assert.equal(ghostAt(g, 3), null);
});
