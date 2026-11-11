import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CATALOG } from "../app/shop/catalog";
import {
  SKIN_PALETTES,
  FIREBALL_PALETTES,
  HAT_ANCHOR,
  shiftPixels,
  tintFrames,
  hatImage,
  headTop,
} from "../app/game/cosmetics";
import { arena, makeWorld, tick } from "./helpers";

test("every catalogue skin and fireball colour has a palette", () => {
  CATALOG.skin.forEach(({ id }) => assert.ok(Array.isArray(SKIN_PALETTES[id]), `skin ${id}`));
  CATALOG.fireball.forEach(({ id }) =>
    assert.ok(Array.isArray(FIREBALL_PALETTES[id]), `fireball ${id}`),
  );
  assert.equal(SKIN_PALETTES.classic.length, 0);
  assert.ok(SKIN_PALETTES.gold.length > 0);
  assert.ok(HAT_ANCHOR.left && HAT_ANCHOR.right);
});

test("shiftPixels recolours matches and never touches alpha or empty pixels", () => {
  const palette = [
    [
      [10, 20, 30],
      [200, 100, 50],
    ],
  ];
  const data = new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 255]);
  shiftPixels(data, palette);
  assert.deepEqual(Array.from(data), [200, 100, 50, 255, 1, 2, 3, 255]);

  const soft = new Uint8ClampedArray([10, 20, 30, 128, 10, 20, 30, 0]);
  shiftPixels(soft, palette);
  assert.deepEqual(Array.from(soft), [200, 100, 50, 128, 10, 20, 30, 0]);
});

test("shiftPixels keeps the shading of near colours", () => {
  const data = new Uint8ClampedArray([14, 20, 30, 255]);
  shiftPixels(data, [
    [
      [10, 20, 30],
      [200, 100, 50],
    ],
  ]);
  assert.deepEqual(Array.from(data), [204, 100, 50, 255]);
});

test("classic tintFrames returns the very same frames", () => {
  const frames = [{}, {}];
  assert.equal(tintFrames(frames, SKIN_PALETTES.classic), frames);
  assert.equal(tintFrames(frames, null), frames);
});

test("hatImage is null for none and the sprite path for each hat", () => {
  assert.equal(hatImage("none"), null);
  CATALOG.hat
    .filter(({ id }) => id !== "none")
    .forEach(({ id }) => {
      assert.equal(hatImage(id).src, `./assets/sprites/hats/${id}.webp`);
    });
});

test("a skin and a hat do not change how the dino plays", async () => {
  const run = async (look) => {
    const world = makeWorld(arena());
    await Promise.resolve(); // frames load, so the look is really applied
    if (look) world.player.setLook(look);
    const { player } = world;
    for (let i = 0; i < 60; i++) {
      if (i === 5) player.jump();
      if (i === 30) player.jump();
      player.moveRight();
      tick(world);
    }
    return [player.x, player.y, player.velocityX, player.velocityY, player.hearts, player.airJumps];
  };
  assert.deepEqual(await run({ skin: "gold", hat: "crown" }), await run(null));
});

test("a fireball colour does not change the fireball", async () => {
  const shoot = async (colour) => {
    const world = makeWorld(arena());
    await Promise.resolve();
    if (colour) world.fireballs.setColour(colour);
    world.shootFireball("f1");
    const [f] = world.fireballs.items;
    return [f.velocity, f.width, f.height, f.hitbox()];
  };
  assert.deepEqual(await shoot("blue"), await shoot(null));
});

test("the 5 hat sprites exist and are at most 12 px wide", () => {
  ["cap", "party", "viking", "wizard", "crown"].forEach((id) => {
    const file = `app/assets/sprites/hats/${id}.webp`;
    assert.ok(fs.existsSync(file), file);
    const buf = fs.readFileSync(file);
    assert.equal(buf.toString("ascii", 0, 4), "RIFF");
    // lossless webp (VP8L) stores width-1 in 14 bits after the 0x2f signature
    assert.equal(buf.toString("ascii", 12, 16), "VP8L");
    const width = (buf.readUInt16LE(21) & 0x3fff) + 1;
    assert.ok(width <= 12, `${id} is ${width}px wide`);
  });
});

test("headTop finds the first opaque row and the middle of its pixels", () => {
  const width = 6;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x, y, alpha = 255) => (data[(y * width + x) * 4 + 3] = alpha);
  paint(0, 0, 40); // faint: not part of the sprite
  paint(2, 1);
  paint(4, 1);
  paint(1, 3);
  assert.deepEqual(headTop(data, width, height), { x: 3, y: 1 });
  assert.equal(headTop(new Uint8ClampedArray(width * height * 4), width, height), null);
});
