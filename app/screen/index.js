import TileSet from "./tileset";

export default class Screen {
  constructor(canvas, world) {
    this.buffer = canvas.getContext("2d");
    this.canvas = canvas;

    this.tileSet = new TileSet(16, 8, world);
  }

  drawMap(map) {
    const { images, tileSize } = this.tileSet;

    const drawTile = (x, y, value) => {
      const image = images[value];

      let destinationX = x * tileSize;
      let destinationY = y * tileSize;

      this.buffer.drawImage(image, destinationX, destinationY, tileSize, tileSize);
    };

    for (let i = 0; i < map.length; i++) {
      const row = map[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];

        if (value) {
          if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
              drawTile(j, i, value[index]);
            }
          } else {
            drawTile(j, i, value);
          }
        }
      }
    }
  }

  drawArea(object) {
    for (let index = 0; index < object.length; index++) {
      const { x, y, width, height } = object[index];
      this.buffer.fillRect(x, y, width, height);
    }
  }

  drawMapObjects(objects) {
    const { objectImages, tileSize } = this.tileSet;

    for (let i = 0; i < objects.length; i++) {
      const row = objects[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];

        if (value) {
          value.forEach((element) => {
            const { id, xOffset = 0, yOffset = 0, width = 16, height = 16 } = element;
            const image = objectImages[id];

            let destinationX = j * tileSize;
            let destinationY = i * tileSize;

            this.buffer.drawImage(
              image,
              destinationX + xOffset,
              destinationY + yOffset,
              width,
              height,
            );
          });
        }
      }
    }
  }

  drawBackground() {
    this.buffer.drawImage(
      this.tileSet.tileBackground,
      0,
      0,
      this.buffer.canvas.width,
      this.buffer.canvas.height,
    );
  }

  drawText(text, x, y, color = "black") {
    this.buffer.fillStyle = color;
    this.buffer.font = "10px Arial";
    this.buffer.fillText(text, x, y);
  }

  drawPlayer(image, destinationX, destinationY, width, height, offsetX, offsetY, rect) {
    this.drawObject(image, destinationX + offsetX, destinationY + offsetY + 1, width, height);
  }

  drawDino(image, destinationX, destinationY, width, height, offsetX, offsetY, rect) {
    this.drawObject(image, destinationX + offsetX, destinationY + offsetY + 1, width, height);
  }

  drawObject(image, destinationX, destinationY, width, height, offsetX = 0, offsetY = 0) {
    this.buffer.drawImage(image, destinationX + offsetX, destinationY + offsetY, width, height);
  }

  drawRect({ x, y, width, height }) {
    this.buffer.fillRect(x, y, width, height);
  }

  get assetCount() {
    return this.tileSet.assetCount;
  }

  get loadCount() {
    return this.tileSet.loadCount;
  }

  isLoaded() {
    return this.tileSet.loaded;
  }

  getContainSize(parentWidth, parentHeight, childWidth, childHeight) {
    const contains = true;
    const doRatio = childWidth / childHeight;
    const cRatio = parentWidth / parentHeight;
    let width = parentWidth;
    let height = parentHeight;

    if (contains ? doRatio > cRatio : doRatio < cRatio) {
      height = width / doRatio;
    } else {
      width = height * doRatio;
    }

    return [width, height];
  }

  resize(ww, wh, gW, gH) {
    const [width] = this.getContainSize(ww, wh, gW, gH);

    const scale = window.devicePixelRatio;

    this.canvas.style.height = gH + "px";
    this.canvas.style.width = gW + "px";
    this.canvas.height = Math.floor(gH * scale * scale);
    this.canvas.width = Math.floor(gW * scale * scale);
    this.buffer.scale(scale, scale);

    const cssScale = width / gW;

    this.canvas.style.transform = `scale(${cssScale})`;

    this.buffer.webkitImageSmoothingEnabled = false;
    this.buffer.mozImageSmoothingEnabled = false;
    this.buffer.imageSmoothingEnabled = false;
  }

  render() {
    this.buffer.drawImage(
      this.buffer.canvas,
      0,
      0,
      this.buffer.canvas.width,
      this.buffer.canvas.height,
      0,
      0,
      this.buffer.canvas.width,
      this.buffer.canvas.height,
    );
  }
}
