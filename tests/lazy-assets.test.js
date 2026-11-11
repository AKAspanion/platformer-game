import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World from "../app/game/world";
import Game from "../app/game";
import AudioController from "../app/controller/audio";
import sfx, { loadSfx, resetSfxGap } from "../app/controller/sfx";
import { preLoadAndFetch, populateHelp, loadHelpIcons } from "../app/util";

// These tests share one module graph (sprites are cached for the whole run, as
// in the browser), so they run in order: home screen, a level, a boss, again.

const requested = () => globalThis.__requested;
const mark = () => requested().length;
const since = (start) => requested().slice(start);
const isAudio = (src) => /assets\/audio\//.test(src);
const isEnemy = (src) => /sprites\/enemies\//.test(src);
const isBoss = (src) => /sprites\/enemies\/boss\//.test(src);
const kindsIn = (srcs) =>
  [...new Set(srcs.filter((s) => isEnemy(s) && !isBoss(s)).map((s) => s.split("/")[4]))].sort();

/** What the page asks for on the home screen: the game shell, plus the link prefetches. */
const bootHome = () => {
  const hrefs = [];
  globalThis.document = {
    getElementsByTagName: () => [{ prepend: (link) => hrefs.push(link.href) }],
    createElement: () => ({}),
  };
  preLoadAndFetch();
  delete globalThis.document;
  const game = new Game(() => {});
  return { game, hrefs };
};

test("home screen: no level music, sound effects, enemy or boss sprites", async () => {
  const start = mark();
  const { hrefs } = bootHome();
  await Promise.resolve();
  const asked = [...since(start), ...hrefs];
  const bad = asked.filter((src) => isAudio(src) || isEnemy(src));
  assert.deepEqual(bad, [], `home screen asked for ${bad.join(", ")}`);
});

test("help tip icons are requested when Help opens, not on the home screen", () => {
  const imgs = [];
  const element = (tag) => {
    const el = tag === "img" ? new globalThis.Image() : {};
    el.dataset = {};
    el.style = {};
    el.children = [];
    el.appendChild = (child) => el.children.push(child);
    el.append = (...kids) => el.children.push(...kids);
    el.innerHTML = "";
    if (tag === "img") imgs.push(el);
    return el;
  };
  globalThis.document = {
    getElementById: () => element("div"),
    createElement: element,
    createTextNode: (text) => ({ text }),
    querySelectorAll: () => imgs.filter((img) => img.dataset.src),
  };
  try {
    const start = mark();
    populateHelp();
    assert.deepEqual(since(start).filter(isEnemy), [], "no enemy sprite before Help opens");
    loadHelpIcons();
    const asked = since(start).filter(isEnemy);
    assert.ok(
      asked.some((s) => /beetle/.test(s)) && asked.some((s) => /pig/.test(s)),
      asked.join(),
    );
  } finally {
    delete globalThis.document;
  }
});

test("Grassland 1 asks for its own music and only its enemy kinds", () => {
  const world = new World();
  const start = mark();
  world.reset();
  world.setup(areas[1]);
  const asked = since(start);

  assert.deepEqual(asked.filter(isAudio), ["./assets/audio/grasslands.mp3"]);
  assert.deepEqual(kindsIn(asked), ["chameleon", "pig"]);
  assert.equal(asked.filter(isBoss).length, 0, "no boss sprite");
  assert.equal(asked.filter((s) => /sprites\/enemies\/spitter/.test(s)).length, 0);
});

test("assetsFor lists what an area needs", () => {
  const world = new World();
  const grass = world.assetsFor(areas[1]);
  assert.deepEqual(grass.audio, ["./assets/audio/grasslands.mp3"]);
  assert.deepEqual(kindsIn(grass.images), ["chameleon", "pig"]);
  assert.equal(grass.images.filter(isBoss).length, 0);

  const boss = world.assetsFor(areas[25]);
  assert.ok(boss.audio.includes("./assets/audio/boss-kingPig.mp3"));
  assert.ok(boss.images.some((s) => s.includes("sprites/enemies/boss/kingPig/")));
});

test("a boss level asks for that boss's sprites, and no other boss's", () => {
  const world = new World();
  const start = mark();
  world.reset();
  world.setup(areas[25]);
  const asked = since(start);
  assert.ok(asked.some((s) => s.includes("sprites/enemies/boss/kingPig/")));
  assert.equal(asked.filter((s) => s.includes("boss/frostSlime")).length, 0);
  assert.ok(asked.includes("./assets/audio/boss-kingPig.mp3"));
  assert.equal(asked.filter(isAudio).includes("./assets/audio/iceland.mp3"), false);
});

test("starting the same level twice asks for nothing twice", () => {
  const world = new World();
  world.reset();
  world.setup(areas[1]);
  world.setup(areas[25]);
  const start = mark();
  // the game keeps one world and sets each level up in it
  world.reset();
  world.setup(areas[1]);
  world.reset();
  world.setup(areas[25]);
  world.reset();
  world.setup(areas[1]);
  const again = since(start).filter((src) => isAudio(src) || isEnemy(src));
  assert.deepEqual(again, []);
});

test("music starts only once the level has loaded, never from loadWorld's setup", async () => {
  const world = new World();
  world.reset();
  const starts = [];
  const original = world.audioController.play.bind(world.audioController);
  world.audioController.play = (key, ext) => {
    starts.push(key);
    return original(key, ext);
  };
  // iceland's music is not downloaded yet: it arrives after the sprites
  world.setup(areas[3]);
  assert.deepEqual(starts, [], "setup does not start music");
  assert.equal(world.isLoaded(), false);
  await new Promise((resolve) => setTimeout(resolve)); // the sprites arrive first

  let calls = 0;
  const playTheme = world.playThemeMusic.bind(world);
  world.playThemeMusic = () => {
    calls += 1;
    playTheme();
  };
  const noop = () => {};
  world.update(noop);
  world.update(noop);
  assert.equal(calls, 0, "not while the music is still downloading");
  assert.deepEqual(starts, []);

  globalThis.__audios["./assets/audio/iceland.mp3"].fire("canplaythrough");
  assert.equal(world.isLoaded(), true);
  world.update(noop);
  assert.equal(calls, 1);
  assert.deepEqual(starts, ["iceland"]);
});

test("resume keeps the music quiet while loading and while muted", () => {
  const world = new World();
  world.reset();
  const heard = [];
  world.audioController.play = (key) => heard.push(key);
  world.setup(areas[4]); // desert: music pending
  world.playThemeMusic(); // what resume() calls
  assert.deepEqual(heard, [], "still loading");
});

test("a sound effect is requested the first time it plays, then reused", () => {
  const name = "explosion";
  const url = "./assets/audio/sfx/explosion.wav";
  assert.equal(requested().includes(url), false, "not before it plays");
  const start = mark();
  resetSfxGap();
  sfx(name);
  assert.deepEqual(since(start), [url]);
  assert.ok(globalThis.__played.includes("sfx/explosion.wav"), "plays");

  const second = mark();
  globalThis.__played.length = 0;
  resetSfxGap();
  sfx(name);
  assert.deepEqual(since(second), [], "second play asks for nothing");
  assert.ok(globalThis.__played.includes("sfx/explosion.wav"));
});

test("the core sounds are requested on first play and not again", () => {
  const start = mark();
  AudioController.play("jump", "wav");
  assert.deepEqual(since(start), ["./assets/audio/jump.wav"]);
  const second = mark();
  AudioController.play("jump", "wav");
  assert.deepEqual(since(second), []);
});

test("loadSfx downloads sounds once and resolves when they can play", async () => {
  const start = mark();
  const done = loadSfx(["gate", "powerup"]);
  assert.deepEqual(since(start).sort(), [
    "./assets/audio/sfx/gate.wav",
    "./assets/audio/sfx/powerup.wav",
  ]);
  globalThis.__audios["./assets/audio/sfx/gate.wav"].fire("canplaythrough");
  globalThis.__audios["./assets/audio/sfx/powerup.wav"].fire("canplaythrough");
  await done;
  const again = mark();
  await loadSfx(["gate"]);
  assert.deepEqual(since(again), []);
});

test("a sound that fails to load never throws", async () => {
  const done = loadSfx(["heart"]);
  globalThis.__audios["./assets/audio/sfx/heart.wav"].fire("error");
  await done; // resolves rather than rejecting
  resetSfxGap();
  assert.doesNotThrow(() => sfx("heart"));

  // and play() itself rejecting (blocked, or the file is missing)
  const base = globalThis.__audios["./assets/audio/sfx/shield-block.wav"];
  assert.equal(base, undefined);
  resetSfxGap();
  sfx("shield-block");
  const failing = globalThis.__audios["./assets/audio/sfx/shield-block.wav"];
  failing.play = () => Promise.reject(new Error("missing"));
  failing.cloneNode = () => failing;
  resetSfxGap();
  assert.doesNotThrow(() => sfx("shield-block"));
  await Promise.resolve();
});
