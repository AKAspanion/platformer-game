export default class TileSet {
  constructor(tileSize, columns) {
    this.columns = columns;
    this.tileSize = tileSize;

    this.images = [];
    this.images.push(null);
    this.tileBackground = new Image();

    for (let index = 1; index <= 18; index++) {
      const image = new Image();
      image.src = `./assets/tilesets/world-1/tiles/${index}.png`;

      this.images.push(image);
    }

    this.tileBackground.src = "./assets/tilesets/world-1/tiles/bg.png";
  }
}
