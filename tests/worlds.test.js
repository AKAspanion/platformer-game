import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World from "../app/game/world";
import { BOSS_MOVES } from "../app/game/boss";
import { enemyTypes } from "../app/game/enemies";
import { createCustomSession } from "../app/modes";
import { buildLevel, validate } from "../app/pcg/generator";
import { OPTIONS, specFromPrompt, sanitizeWorld, newWorld } from "../app/worlds/spec";
import { LocalRepository, FirestoreRepository, mergeWorlds } from "../app/worlds/repository";
import { buildEnemy, buildBossFrames, enemySize } from "../app/gen/creatures";
import { buildTiles, buildBackground, buildObjects, buildLiquid } from "../app/gen/scenery";
import { composeTrack, creatureSounds, bossSounds, encodeWav, RATE } from "../app/gen/audio";
import { buildWorld, previewWorld } from "../app/gen";
import { getSkin, audioSrc } from "../app/util/registry";
import { createAuth } from "../app/auth";
import { mockAuthBackend } from "../app/auth/mock";
import { tick } from "./helpers";

const world = (prompt, seed = 7) => ({
  id: `w${Buffer.from(prompt).toString("hex").slice(0, 20)}${seed}`,
  name: "Test",
  spec: specFromPrompt(prompt),
  seed,
});

// ---------------------------------------------------------------- spec

test("the spec's boss moves are exactly the moves bosses know", () => {
  assert.deepEqual([...OPTIONS.bossMoves].sort(), [...BOSS_MOVES].sort());
});

test("sanitizeWorld keeps good records and rejects unplayable ones", () => {
  const user = { uid: "u_1", displayName: "Ana" };
  const made = newWorld(specFromPrompt("ice cave"), user);
  assert.ok(made && /^w/.test(made.id));
  assert.equal(made.author.name, "Ana");
  assert.equal(made.spec.version, 2);
  assert.deepEqual(sanitizeWorld(JSON.parse(JSON.stringify(made))), made);

  assert.equal(sanitizeWorld(null), null);
  assert.equal(sanitizeWorld({ id: "../../etc" }), null);
  assert.equal(sanitizeWorld({ id: "a" }), null);
  const odd = sanitizeWorld({
    id: "abcd1234",
    name: "<img src=x onerror=alert(1)>",
    author: { uid: "x<y>", name: "<b>Bob</b>" },
    seed: "nope",
  });
  assert.ok(!/[<>]/.test(odd.name + odd.author.name + odd.author.uid));
  assert.ok(Number.isInteger(odd.seed));
});

// ----------------------------------------------------------------- art

test("every creature design gets walk, attack and death frames, mirrored", () => {
  for (const behavior of OPTIONS.behaviors)
    for (const body of OPTIONS.bodies) {
      const design = {
        behavior,
        body,
        color: "#3a9a2a",
        accent: "#ff9a2a",
        features: ["horns", "tail", "teeth"],
        speed: "fast",
        armored: body === "bug",
      };
      const { config, frames } = buildEnemy(design, 3);
      const label = `${behavior}/${body}`;
      assert.equal(config.kind, behavior, label);
      assert.deepEqual({ width: config.width, height: config.height }, enemySize(design));
      assert.equal(frames.right.length, 4, label);
      assert.equal(frames.deadRight.length, 8, label);
      assert.equal(frames.left.length, frames.right.length, label);
      if (behavior === "walker") assert.equal(frames.attackRight.length, 4, label);
      if (behavior === "turret") assert.equal(frames.attackRight.length, config.shoot, label);
      // drawn at 2x the hit box; death frames at 2x that
      assert.equal(frames.right[0].width, config.width * 2, label);
      assert.equal(frames.deadRight[0].width, config.width * 4, label);
      frames.right.forEach((f) => assert.ok(f.coverage() > 60, `${label}: walk frame is drawn`));
      const r = frames.right[0];
      const l = frames.left[0];
      assert.deepEqual(
        l.get(0, Math.floor(r.height / 2)),
        r.get(r.width - 1, Math.floor(r.height / 2)),
      );
      if (body === "bug") assert.equal(config.hp, 2, "armoured bugs take two fireballs");
    }
});

test("bosses get walk, attack and death frames with a crown above the hit box", () => {
  [false, true].forEach((flyer) => {
    const { size, frames } = buildBossFrames(
      { body: "box", color: "#aa3344", accent: "#ffcc00", features: ["horns"], flyer },
      5,
    );
    ["walk", "attack"].forEach((name) => {
      assert.equal(frames[`${name}-right`].length, 4);
      assert.equal(frames[`${name}-left`].length, 4);
      assert.equal(frames[`${name}-right`][0].height, (size.height + size.crown) * 2);
    });
    assert.equal(frames["dead-right"].length, 8);
  });
});

test("scenery: tiles for every id the generator uses, a backdrop, decor, liquid", () => {
  for (const surface of OPTIONS.surfaces)
    for (const skyline of OPTIONS.skylines) {
      const spec = specFromPrompt("x");
      spec.terrain.surface = surface;
      spec.backdrop.skyline = skyline;
      const tiles = buildTiles(spec, 1);
      [1, 2, 3, 4, 5, 6, 8, 10, 13, 14, 15].forEach((id) => {
        assert.equal(tiles[id].width, 16, `${surface}: tile ${id}`);
        assert.ok(tiles[id].coverage() > 60, `${surface}: tile ${id} drawn`);
      });
      const bg = buildBackground(spec, 1);
      assert.deepEqual([bg.width, bg.height], [336, 192]);
      assert.equal(bg.coverage(), 336 * 192, `${skyline}: sky covers the backdrop`);
    }
  const objects = buildObjects(specFromPrompt("a jungle"), 2);
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 15].forEach((id) =>
    assert.ok(objects[id].coverage() > 4, `object ${id}`),
  );
  const liquid = buildLiquid(specFromPrompt("lava"), 2);
  assert.equal(liquid.surface.length, 8);
  assert.equal(liquid.body.length, 8);
});

test("the same world paints the same pixels on every device", () => {
  const a = previewWorld(world("crystal caves with bats", 11));
  const b = previewWorld(world("crystal caves with bats", 11));
  assert.deepEqual(a.data, b.data);
  const c = previewWorld(world("crystal caves with bats", 12));
  assert.notDeepEqual(a.data, c.data);
});

// --------------------------------------------------------------- audio

test("music: an exact, clean loop in the world's tempo; boss track is faster", () => {
  const music = { mood: "heroic", tempo: 120, lead: "square" };
  const theme = composeTrack(music, 5);
  const boss = composeTrack(music, 5, { boss: true });
  const step = Math.round((60 / 120 / 4) * RATE);
  assert.equal(theme.samples.length, step * 16 * theme.bars);
  assert.ok(boss.bpm > theme.bpm);
  for (const { samples } of [theme, boss]) {
    let peak = 0;
    let energy = 0;
    for (const s of samples) {
      assert.ok(Number.isFinite(s));
      peak = Math.max(peak, Math.abs(s));
      energy += s * s;
    }
    assert.ok(peak <= 1 && peak > 0.3, `peak ${peak}`);
    assert.ok(energy / samples.length > 0.005, "not silent");
  }
  assert.deepEqual(composeTrack(music, 5).samples, theme.samples, "deterministic");
  for (const mood of OPTIONS.moods)
    for (const lead of OPTIONS.leads) {
      assert.ok(composeTrack({ mood, tempo: 150, lead }, 1, { bars: 2 }).samples.length > 0);
    }
});

test("sound effects and WAV encoding", () => {
  const s = creatureSounds({ behavior: "flyer", body: "round" }, 1);
  const b = bossSounds({}, { mood: "epic" }, 1);
  [s.attack, s.die, b.roar, b.hit, b.defeat].forEach((samples) => {
    assert.ok(samples.length > RATE * 0.2);
    assert.ok(samples.some((v) => Math.abs(v) > 0.2));
  });
  const wav = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5])));
  assert.equal(String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(i))), "RIFF");
  assert.equal(wav.getUint32(24, true), RATE);
  assert.equal(wav.getUint32(40, true), 8);
  assert.equal(wav.getInt16(46, true), 0x7fff);
  assert.equal(wav.getInt16(48, true), -0x8000);
});

// ---------------------------------------------------------- the engine

test("buildWorld registers the skin, creatures, boss and music with the engine", () => {
  const w = world("a haunted candy factory with a ghost king");
  const built = buildWorld(w);
  assert.ok(getSkin(built.key), "skin");
  built.types.forEach(({ type }) => assert.ok(enemyTypes[type], type));
  assert.notEqual(audioSrc(`${built.key}-theme`, "mp3"), `./assets/audio/${built.key}-theme.mp3`);
  assert.notEqual(
    audioSrc(`boss-${built.bossKind}`, "mp3"),
    `./assets/audio/boss-${built.bossKind}.mp3`,
  );
  assert.equal(built.levels.length, 6);
  assert.equal(built.levels[5].boss, built.bossKind);
  assert.ok(built.levels.every((l) => l.difficulty >= built.spec.difficulty && l.difficulty <= 5));
});

test("generated levels use the world's own pits, flyers and turrets", () => {
  const enemyKinds = { g1: "walker", g2: "flyer", g3: "turret" };
  let flyers = 0;
  let turrets = 0;
  for (let seed = 1; seed < 40; seed++) {
    const result = buildLevel(
      {
        id: 4100,
        world: 1,
        decorSet: "gen",
        theme: "gen",
        style: { pits: "liquid", traps: true },
        difficulty: 4,
        enemyTypes: ["g1", "g2", "g3"],
        enemyKinds,
        entryHeight: 9,
        exitHeight: 9,
        prev: { area: null, x: 0 },
        next: { area: 4101, x: 0 },
      },
      seed,
    );
    if (validate(result)) continue;
    const { data } = result;
    data.enemies.forEach((e) => assert.ok(enemyKinds[e.type], e.type));
    flyers += data.enemies.filter((e) => e.type === "g2").length;
    turrets += data.enemies.filter((e) => e.type === "g3").length;
    // every pit is liquid
    data.death
      .filter((d) => d.y >= 160)
      .forEach((d) => {
        const col = Math.floor(d.x / 16);
        assert.ok(
          data.water.some((w) => w.left === col),
          `seed ${seed}: pit at ${col} has liquid`,
        );
      });
  }
  assert.ok(flyers > 0, "flyers over pits");
  assert.ok(turrets > 0, "a turret now and then");
});

test("a generated boss fights with its moves, summons its minions and can be beaten", () => {
  const w = world("a lava volcano ruled by a magma titan, hard", 21);
  w.spec.boss.moves = ["charge", "summon", "fan"];
  w.spec.boss.flyer = false;
  const session = createCustomSession(w, { audio: false });
  const arena = areas[session.startId + 5];
  const game = new World();
  game.reset();
  game.player.setLeft(60);
  game.player.setTop(8 * 16 - 20);
  game.setup(arena);
  assert.ok(game.boss, "boss is there");
  assert.equal(game.boss.name, w.spec.boss.name);
  let over = 0;
  game.player.invulnerable = 1e9;
  for (let i = 0; i < 1500 && game.boss.performed.size < 3; i++) {
    game.player.invulnerable = 1e9;
    game.player.hearts = 3;
    tick(game, 1, () => over++);
  }
  assert.deepEqual([...game.boss.performed].sort(), ["charge", "fan", "summon"]);
  const boss = game.boss;
  assert.ok(
    game.enemies.items.some((e) => e.id.startsWith(boss.id)),
    "minions came",
  );
  for (let i = 0; i < boss.maxHp; i++) {
    boss.alpha = 1;
    game.hitBoss(1);
  }
  assert.ok(boss.dying);
});

// --------------------------------------------------------------- auth

test("sign-in: checks input, restores the session, signs out", async () => {
  localStorage.removeItem("mock_auth");
  const auth = createAuth(mockAuthBackend());
  const seen = [];
  const off = auth.onAuthStateChanged((user) => seen.push(user && user.displayName));
  await auth.ready(100);
  assert.equal(auth.currentUser, null);
  assert.ok(auth.known);

  await assert.rejects(auth.signInWithGoogle({ name: "x" }), /2 letters/);
  await assert.rejects(auth.signInWithEmail({ email: "nope", password: "secret1" }), /email/);
  await assert.rejects(auth.signInWithEmail({ email: "a@b.co" }), /password/);
  await assert.rejects(
    auth.signInWithEmail({ email: "a@b.co", password: "123", name: "Ana", create: true }),
    /6 characters/,
  );
  await assert.rejects(
    auth.signInWithEmail({ email: "a@b.co", password: "secret1", name: "", create: true }),
    /2 letters/,
  );
  await assert.rejects(auth.resetPassword(""), /email/);

  const user = await auth.signInWithEmail({
    email: " a@b.co ",
    password: "secret1",
    name: "  Ana <3 ",
    create: true,
  });
  assert.equal(user.displayName, "Ana 3");
  assert.equal(user.provider, "email");
  await assert.rejects(
    auth.signInWithEmail({ email: "a@b.co", password: "secret1", name: "Ana", create: true }),
    /already has an account/,
  );
  await assert.rejects(auth.signInWithEmail({ email: "a@b.co", password: "wrong!" }), /Wrong/);

  // another launch of the game: the session comes back
  const later = createAuth(mockAuthBackend());
  later.resume();
  await later.ready(100);
  assert.equal(later.currentUser.uid, user.uid, "stays signed in");

  await auth.signOut();
  assert.equal(auth.currentUser, null);
  const again = await auth.signInWithEmail({ email: "a@b.co", password: "secret1" });
  assert.equal(again.uid, user.uid, "same account");
  off();
  assert.deepEqual(seen, [null, "Ana 3", null, "Ana 3"]);

  const none = createAuth();
  await assert.rejects(none.signInWithGoogle(), /isn't available/);
});

// --------------------------------------------------------- repository

test("local repository: starter worlds, newest first, live", async () => {
  localStorage.removeItem("shared_worlds");
  const repo = new LocalRepository();
  const starters = await repo.list();
  assert.ok(starters.length >= 3);
  starters.forEach((w) => assert.ok(sanitizeWorld(w)));

  const heard = [];
  const off = repo.subscribe((w) => heard.push(w.id));
  const made = newWorld(specFromPrompt("reef"), { uid: "u1", displayName: "Kai" });
  await assert.rejects(repo.publish({ id: "!" }), /can't be shared/);
  await repo.publish(made);
  assert.deepEqual(heard, [made.id]);
  const list = await repo.list();
  assert.equal(list[0].id, made.id);
  // another install (tab) sees it too
  assert.equal((await new LocalRepository().list())[0].id, made.id);
  off();
});

test("firestore repository: lists, publishes, delivers new worlds once, works offline", async () => {
  localStorage.removeItem("shared_worlds_cache");
  const made = newWorld(specFromPrompt("moon base"), { uid: "u2", displayName: "Lee" });
  const other = newWorld(
    specFromPrompt("desert"),
    { uid: "u3", displayName: "Sam" },
    { now: made.createdAt + 1000 },
  );
  let online = true;
  let added = null;
  let stopped = 0;
  const published = [];
  const adapter = {
    async list(count) {
      if (!online) throw new Error("No connection.");
      assert.equal(count, 60);
      return [made, { id: "bad id!" }];
    },
    async get(id) {
      return id === made.id ? made : null;
    },
    watch(count, onAdded) {
      assert.equal(count, 20);
      added = onAdded;
      return () => stopped++;
    },
    async publish(world) {
      published.push(world);
      // the server stamps the author and time
      return { ...world, author: { uid: "u3", name: "Sam S" }, createdAt: world.createdAt + 5 };
    },
  };
  const repo = new FirestoreRepository(adapter);
  assert.equal(repo.live, true);
  assert.deepEqual(
    (await repo.list()).map((w) => w.id),
    [made.id],
  );
  assert.equal((await repo.get(made.id)).name, made.name);
  assert.equal(await repo.get("nope"), null);

  const saved = await repo.publish(other);
  assert.equal(published.length, 1);
  assert.equal(saved.author.name, "Sam S");
  await assert.rejects(repo.publish({ id: "x" }), /can't be shared/);

  const heard = [];
  const off = repo.subscribe((w) => heard.push(w.id));
  const off2 = repo.subscribe(() => {});
  const third = newWorld(specFromPrompt("jungle"), { uid: "u4", displayName: "Mo" });
  added(third);
  added(third); // duplicate
  added(other); // our own publish
  added({ id: "bad id!" });
  assert.deepEqual(heard, [third.id]);
  off();
  assert.equal(stopped, 0, "still one listener");
  off2();
  assert.equal(stopped, 1, "stops listening with the last listener");

  // offline: the last list, marked stale
  online = false;
  const cached = await repo.list();
  assert.ok(cached.stale);
  assert.deepEqual(
    cached.map((w) => w.id),
    [other.id, made.id],
  );
  localStorage.removeItem("shared_worlds_cache");
  await assert.rejects(repo.list(), /No connection/);

  assert.deepEqual(
    mergeWorlds([made], [other, made]).map((w) => w.id),
    [other.id, made.id],
  );
});
