import Object from "./object";
import { requestImage } from "./preload";

/**
 * The hidden egg of a level (data.egg: { id, left, top } in tiles, like a coin).
 * Touching it hands the find to the shell through world.feats; it gives no
 * score and no coins. The icon is scripts/generate-sprites.py's egg.png.
 */
const WIDTH = 11;
const HEIGHT = 14;

export default class Egg extends Object {
  constructor({ id, left, top }, tileSize = 16) {
    // centred on its tile column, resting on the tile floor
    super(
      Math.floor(left) * tileSize + (tileSize - WIDTH) / 2,
      (Math.floor(top) + 1) * tileSize - HEIGHT,
      WIDTH,
      HEIGHT,
    );
    this.id = id;
    this.baseY = this.y;
    this.phase = Math.random() * Math.PI * 2;
    // counted by the loading bar only while the icon is still in flight
    this.assetCount = 0;
    this.loadCount = 0;
    this.image = requestImage("./assets/sprites/items/egg.png", this);
  }

  get loaded() {
    return this.loadCount >= this.assetCount;
  }

  update() {
    this.phase += 0.08;
    this.y = this.baseY - 1 + Math.sin(this.phase);
  }

  /** Pulsing glow radius for the draw call. */
  get glow() {
    return 8 + Math.sin(this.phase * 2) * 1.2;
  }
}
