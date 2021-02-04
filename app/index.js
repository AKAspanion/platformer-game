import Game from "./game";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";

import * as areas from "./areas";

window.addEventListener("load", function () {
  "use strict";

  let areaId = "1";

  const controller = new Controller();

  // GAME
  const game = new Game();

  const setupWorld = () => {
    game.world.setup(areas[`area${areaId}`]);
  };

  setupWorld();

  // SCREEN
  let screen;

  const setupScreen = () => {
    screen = new Screen(document.querySelector("canvas"), areas[`area${areaId}`].world);

    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
  };

  setupScreen();

  // GAME ENGINE

  const update = () => {
    if (!game.over) {
      if (controller.left.active) {
        game.world.player.moveLeft();
      }
      if (controller.right.active) {
        game.world.player.moveRight();
      }
      if (controller.up.active) {
        game.world.player.jump();
        controller.up.active = false;
      }
    }

    if (game.world.portal) {
      engine.hold();

      areaId = game.world.portal.destinationArea;

      setupWorld();
      setupScreen();

      engine.resume();
    }

    game.update();
  };

  const render = () => {
    screen.drawBackground();
    screen.drawMap(game.world.map);
    screen.drawMapObjects(game.world.objects);
    // screen.drawDeathArea(game.world.deathAreas);

    if (game.world.coins) {
      for (let index = 0; index < game.world.coins.items.length; index++) {
        const coin = game.world.coins.items[index];

        screen.drawObject(
          coin.animator.frameValue,
          coin.x,
          coin.y,
          coin.width,
          coin.height,
          coin.offsetX,
          coin.offsetY
        );
        // screen.drawRect(coin);
      }
    }

    if (game.world.water) {
      for (let index = 0; index < game.world.water.items.length; index++) {
        const waterItem = game.world.water.items[index];

        screen.drawObject(
          waterItem.animator.frameValue,
          waterItem.x,
          waterItem.y,
          waterItem.width,
          waterItem.height,
          waterItem.offsetX,
          waterItem.offsetY
        );
        // screen.drawRect(waterItem);
      }
    }

    const { direction } = game.world.player;

    screen.drawPlayer(
      game.world.player.animator.frameValue,
      game.world.player.getLeft(),
      game.world.player.getTop(),
      60,
      40,
      direction < 0 ? -32 : -16,
      -24
    );
    screen.drawRect(game.world.player);
    screen.render();
  };

  const resize = () => {
    screen.resize(
      document.documentElement.clientWidth - 32,
      document.documentElement.clientHeight - 32,
      game.world.height / game.world.width
    );
    screen.render();
  };

  resize();

  var engine = new GameEngine(1000 / 30, update, render);

  engine.start();

  // EVENTS HANDLER
  const keyDownUp = ({ type, keyCode }) => {
    controller.keyDownUp(type, keyCode);
  };

  window.addEventListener("keydown", keyDownUp);
  window.addEventListener("keyup", keyDownUp);
  window.addEventListener("resize", resize);
});
