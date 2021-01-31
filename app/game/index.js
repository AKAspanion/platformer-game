import World from "./world";

export default class Game {
  constructor() {
    this.world = new World();
  }

  update() {
    this.world.update();
  }
}
