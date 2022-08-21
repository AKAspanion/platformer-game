export default class Screen {
  constructor(canvas) {
    this.buffer = canvas.getContext("2d");
    this.canvas = canvas;
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

  resize(w) {
    const width = 600;
    const height = 300;

    const scale = window.devicePixelRatio;

    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.canvas.width = Math.floor(width * scale);
    this.canvas.height = Math.floor(height * scale);
    this.buffer.scale(scale, scale);

    const cssScale = w / width;

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
      this.buffer.canvas.height
    );
  }
}
