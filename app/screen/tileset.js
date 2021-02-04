export default class TileSet {
  constructor(tileSize, columns, world = 1) {
    const worldKey = `world-${world}`;
    this.columns = columns;
    this.tileSize = tileSize;

    this.images = [];
    this.images.push(null);

    this.objectImages = [];
    this.objectImages.push(null);

    this.tileBackground = new Image();

    for (let index = 1; index <= 11; index++) {
      const image = new Image();
      image.src = `./sprites/${worldKey}/objects/${index}.png`;

      this.objectImages.push(image);
    }

    for (let index = 1; index <= 18; index++) {
      const image = new Image();
      image.src = `./sprites/${worldKey}/tiles/${index}.png`;

      this.images.push(image);
    }

    this.tileBackground.src = `./sprites/${worldKey}/bg.png`;
  }
}
