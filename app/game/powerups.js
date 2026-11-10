import Object from "./object";

/**
 * Collectable power-ups (icons from scripts/generate-sprites.py):
 *  - heart:  +1 heart (score bonus when already full)
 *  - shield: absorbs the next hit
 *  - triple: three fireballs per shot for 15s
 *  - wings:  double jump for 20s
 */
export const POWERUP_TYPES = ["heart", "shield", "triple", "wings"];

const SIZES = { heart: [11, 10], shield: [12, 13], triple: [13, 12], wings: [13, 11] };

let icons = null;
const loader = { assetCount: 0, loadCount: 0 };

export const loadIcons = () => {
  if (icons) return icons;
  icons = {};
  [...POWERUP_TYPES, "hud-heart", "hud-heart-empty"].forEach((key) => {
    const image = new Image();
    image.onload = image.onerror = () => {
      loader.loadCount += 1;
    };
    image.src = `./assets/sprites/items/${key}.png`;
    icons[key] = image;
    loader.assetCount += 1;
  });
  return icons;
};

export default class PowerUps {
  constructor(items = [], tileSize = 16, collected = "") {
    this.icons = loadIcons();
    const taken = new Set(collected.split(","));
    this.items = items
      .filter(({ id, type }) => !taken.has(id) && POWERUP_TYPES.includes(type))
      .map(({ id, type, left, top }) => new PowerUp(id, type, left * tileSize, top * tileSize));
  }

  get assetCount() {
    return loader.assetCount;
  }

  get loadCount() {
    return loader.loadCount;
  }

  get loaded() {
    return loader.loadCount >= loader.assetCount;
  }

  remove(item) {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  update() {
    this.items.forEach((item) => item.update());
  }
}

class PowerUp extends Object {
  constructor(id, type, x, y) {
    const [w, h] = SIZES[type];
    // centred in its tile
    super(x + (16 - w) / 2, y + (16 - h) / 2, w, h);
    this.id = id;
    this.type = type;
    this.baseY = this.y;
    this.phase = Math.random() * Math.PI * 2;
  }

  update() {
    this.phase += 0.1;
    this.y = this.baseY + Math.sin(this.phase) * 1.5;
  }

  /** Pulsing glow radius for the draw call. */
  get glow() {
    return 7 + Math.sin(this.phase * 2) * 1.2;
  }
}
