import Input from "./input";

export default class Controller {
  constructor() {
    this.up = new Input();
    this.left = new Input();
    this.right = new Input();
  }

  keyDownUp(type, keyCode) {
    let down = type == "keydown" ? true : false;

    switch (keyCode) {
      case 37:
        this.left.getInput(down);
        break;
      case 38:
        this.up.getInput(down);
        break;
      case 39:
        this.right.getInput(down);
    }
  }
}
