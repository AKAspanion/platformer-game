export default class TileSet {
  /** `skin` (optional) is a generated tile set from app/util/registry: no files to load. */
  constructor(tileSize, columns, world = 1, skin = null) {
    const worldKey = `world-${world}`;
    this.loaded = false;
    this.failed = false; // a file did not download
    this.columns = columns;
    this.tileSize = tileSize;

    if (skin) {
      this.images = skin.tiles;
      this.objectImages = skin.objects;
      this.tileBackground = skin.background;
      this.assetCount = 1;
      this.loadCount = 1;
      this.loaded = true;
      return;
    }

    this.images = [];
    this.images.push(null);

    this.objectImages = [];
    this.objectImages.push(null);

    this.tileBackground = new Image();

    const meta = {
      1: { objectLen: 11, tileLen: 18 },
      2: { objectLen: 10, tileLen: 18 },
      3: { objectLen: 15, tileLen: 16 },
      4: { objectLen: 14, tileLen: 16 },
      5: { objectLen: 12, tileLen: 25 },
    };

    this.loadCount = 0;
    this.assetCount = meta[world].objectLen + meta[world].tileLen + 1;
    const onImgLoad = (e) => {
      this.loadCount += 1;

      if (this.assetCount === this.loadCount) {
        this.loaded = true;
      }
    };

    // a failed file still counts as in (the level starts), but the set is not kept
    const onImgError = () => {
      this.failed = true;
      onImgLoad();
    };

    for (let index = 1; index <= meta[world].objectLen; index++) {
      const image = new Image();
      image.onload = onImgLoad;
      image.onerror = onImgError;
      image.src = `./assets/sprites/${worldKey}/objects/${index}.png`;

      this.objectImages.push(image);
    }

    for (let index = 1; index <= meta[world].tileLen; index++) {
      const image = new Image();
      image.onload = onImgLoad;
      image.onerror = onImgError;
      image.src = `./assets/sprites/${worldKey}/tiles/${index}.png`;

      this.images.push(image);
    }

    this.tileBackground.src = `./assets/sprites/${worldKey}/bg.png`;
    this.tileBackground.onload = onImgLoad;
    this.tileBackground.onerror = onImgError;
  }
}

const cache = new Map(); // world -> its tile set
const skinned = new WeakMap(); // generated skin -> its tile set

/** The tile set for a world (or a generated skin), made once and reused unless a download failed. */
export function tileSetFor(tileSize, columns, world, skin = null) {
  if (skin) {
    if (!skinned.has(skin)) skinned.set(skin, new TileSet(tileSize, columns, world, skin));
    return skinned.get(skin);
  }
  const key = `${world}:${tileSize}:${columns}`;
  // a set that settled with a failed download is dropped: the next ask fetches again
  if (cache.get(key)?.failed && cache.get(key).loaded) cache.delete(key);
  if (!cache.has(key)) cache.set(key, new TileSet(tileSize, columns, world));
  return cache.get(key);
}
