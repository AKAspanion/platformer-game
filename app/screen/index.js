export default class Screen {
  constructor(canvas) {
    this.buffer = document.createElement("canvas").getContext("2d");
    this.context = canvas.getContext("2d");
  }

  drawArea(object) {
    for (let index = 0; index < object.length; index++) {
      const { x, y, width, height } = object[index];
      this.buffer.fillRect(x, y, width, height);
    }
  }

  drawBackground() {
    this.buffer.fillStyle = "#ffffff";
    this.buffer.fillRect(
      0,
      0,
      this.buffer.canvas.width,
      this.buffer.canvas.height
    );
  }

  drawText(text, x, y, color = "black") {
    this.buffer.fillStyle = color;
    this.buffer.font = "10px Arial";
    this.buffer.fillText(text, x, y);
  }

  drawPlayer(
    image,
    destinationX,
    destinationY,
    width,
    height,
    offsetX,
    offsetY,
    rect
  ) {
    this.drawObject(
      image,
      destinationX + offsetX,
      destinationY + offsetY + 1,
      width,
      height
    );
  }

  drawDino(
    image,
    destinationX,
    destinationY,
    width,
    height,
    offsetX,
    offsetY,
    rect
  ) {
    this.drawObject(
      image,
      destinationX + offsetX,
      destinationY + offsetY + 1,
      width,
      height
    );
  }

  drawObject(
    image,
    destinationX,
    destinationY,
    width,
    height,
    offsetX = 0,
    offsetY = 0
  ) {
    this.buffer.drawImage(
      image,
      destinationX + offsetX,
      destinationY + offsetY,
      width,
      height
    );
  }

  drawRect({ x, y, width, height }) {
    this.buffer.fillStyle = "#000";
    this.buffer.fillRect(x, y, width, height);
  }

  get assetCount() {
    return 1;
  }

  get loadCount() {
    return 1;
  }

  isLoaded() {
    return true;
  }

  resize(width, height, ratio) {
    if (height / width > ratio) {
      this.context.canvas.height = width * ratio;
      this.context.canvas.width = width;
    } else {
      this.context.canvas.height = height;
      this.context.canvas.width = height / ratio;
    }

    this.context.webkitImageSmoothingEnabled = false;
    this.context.mozImageSmoothingEnabled = false;
    this.context.imageSmoothingEnabled = false;
  }

  render() {
    this.context.drawImage(
      this.buffer.canvas,
      0,
      0,
      this.buffer.canvas.width,
      this.buffer.canvas.height,
      0,
      0,
      this.context.canvas.width,
      this.context.canvas.height
    );
  }
}
