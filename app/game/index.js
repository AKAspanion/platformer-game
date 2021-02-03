import World from "./world";

export default class Game {
  constructor() {
    this.world = new World();
    this.over = false;

    this.onGameOver = () => {
      this.over = true;
    };
  }

  update() {
    this.world.update(this.onGameOver);
  }
}
