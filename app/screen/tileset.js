export default class TileSet {
  constructor(tileSize, columns) {
    const world = "world-2";
    this.columns = columns;
    this.tileSize = tileSize;

    this.images = [];
    this.images.push(null);

    this.tileBackground = new Image();

    for (let index = 1; index <= 18; index++) {
      const image = new Image();
      image.src = `./sprites/${world}/tiles/${index}.png`;

      this.images.push(image);
    }

    this.tileBackground.src = `./sprites/${world}/bg.png`;
  }
}
