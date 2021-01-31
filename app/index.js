import GameEngine from "./engine";
import Controller from "./controller";

// GAME ENGINE
const update = () => {
  console.log("updating");
};

const render = () => {
  console.log("rendering");
};

const engine = new GameEngine(1000 / 30, update, render);
engine.start();

// EVENTS HANDLER
const controller = new Controller();

const keyDownUp = ({ type, keyCode }) => {
  controller.keyDownUp(type, keyCode);
};

window.addEventListener("keydown", keyDownUp);
window.addEventListener("keyup", keyDownUp);
