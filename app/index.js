import Game from "./game";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";
import MouseInput from "./controller/mouse-input";

import { preLoadAndFetch } from "./util";

preLoadAndFetch();

import areas from "./areas";

const isTouchesEnabled = "ontouchstart" in document.documentElement;

const startBtn = document.getElementById("startBtn");
const startTitle = document.getElementById("startTitle");
const startScreen = document.getElementById("startScreen");
const controllers = document.querySelectorAll(".controller");
const loadingScreen = document.getElementById("loadingScreen");
const progressValue = document.getElementById("progressValue");

const toggleControllers = (value) => {
  controllers.forEach(
    (controller) => (controller.style.visibility = isTouchesEnabled && value ? "visible" : "hidden")
  );
};

const toggleStartScreen = (value) => {
  startScreen.style.visibility = !value ? "hidden" : "visible";
};

const toggleLoadingScreen = (value) => {
  loadingScreen.style.visibility = !value ? "hidden" : "visible";
};

const setProgressValue = (value) => {
  progressValue.style.width = `${value}%`;
};

setProgressValue(50);

window.addEventListener("load", function () {
  "use strict";

  let areaId = 1;
  let loaded = false;
  let areaNumber = 1;
  let worldChanged = false;
  const totalAreaNumber = 3;

  setProgressValue(100);
  toggleLoadingScreen(false);
  setProgressValue(0);

  const controller = new Controller();

  // GAME
  const game = new Game(() => {
    startTitle.textContent = "Game Over";
    setTimeout(() => {
      toggleStartScreen(true);
    }, 1500);
  });

  const setupWorld = () => {
    game.world.setup(areas[areaId]);
  };

  // SCREEN
  let screen;

  const setupScreen = () => {
    screen = new Screen(document.querySelector("canvas"), areas[areaId].world);

    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
  };

  setupScreen();

  // GAME ENGINE

  const loadPercent = () => {
    const totalAssets = (worldChanged ? 0 : game.world.assetCount) + screen.assetCount;
    const totalLoaded = (worldChanged ? 0 : game.world.loadCount) + screen.loadCount;

    return Math.round((totalLoaded / totalAssets) * 100);
  };

  const isLoaded = () => {
    return game.isLoaded() && screen.isLoaded();
  };

  const update = () => {
    loaded = isLoaded();
    const loadValue = loadPercent();

    if (loadValue < 100) {
      setProgressValue(loadValue == 99 ? 100 : loadValue);
    }

    if (!loaded) {
      toggleControllers(false);
      toggleLoadingScreen(true);
    } else {
      toggleLoadingScreen(false);
      toggleControllers(true);
      setProgressValue(0);
    }

    if (!game.over && loaded) {
      if (controller.left.active) {
        game.world.player.moveLeft();
      }
      if (controller.right.active) {
        game.world.player.moveRight();
      }
      if (controller.up.active) {
        if (!game.world.player.jumping) {
          game.world.playJumpSound();
        }
        game.world.player.jump();
        controller.up.active = false;
      }
    }

    if (game.world.portal) {
      worldChanged = true;
      engine.hold();

      const { direction, destinationArea } = game.world.portal;
      if (destinationArea !== areaId) {
        if (direction < 0) {
          areaNumber--;
        } else {
          areaNumber++;
        }

        if (areaNumber === 0) {
          areaNumber = 1;
        }

        if (areaNumber > totalAreaNumber) {
          areaNumber = totalAreaNumber;
        }
      }

      areaId = destinationArea;

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
    // screen.drawArea(game.world.portals);
    // screen.drawArea(game.world.deathAreas);

    // draw coins
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
        // screen.drawText(coin.id, coin.x, coin.y);
        // screen.drawRect(coin);
      }
    }

    // draw water animations
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
      }
    }

    // draw player
    const xOffset = game.world.player.direction < 0 ? -36 : -12;

    screen.drawPlayer(
      game.world.player.animator.frameValue,
      game.world.player.getLeft(),
      game.world.player.getTop(),
      60,
      40,
      xOffset,
      -24
    );

    // draw coin count
    const scoreTextOffest =
      game.world.totalCoins >= 10 && game.world.totalCoins <= 99
        ? 3
        : game.world.totalCoins > 99
        ? 3.4
        : 2.7;
    const image = new Image();
    image.src = "./assets/sprites/coin/image 1.webp";
    screen.drawObject(image, (game.world.columns - 1.3) * 16, 8, 10, 10);
    screen.drawText("x", (game.world.columns - 2) * 16, 15);
    screen.drawText(game.world.totalCoins, (game.world.columns - scoreTextOffest) * 16, 16.1);

    screen.drawText(areaNumber, 48, 15.3);
    screen.drawText("Area", 12, 15.3);
    screen.drawText("x", 38, 15);

    screen.render();
  };

  const resize = () => {
    let width = document.documentElement.clientWidth;
    let height = document.documentElement.clientHeight;

    if (width < 600) {
      [width, height] = [height, width];
    }

    screen.resize(width - 4, height - 4, game.world.height / game.world.width);
    screen.render();
    toggleControllers(true);
  };

  resize();

  var engine = new GameEngine(1000 / 30, update, render);

  // EVENTS HANDLER
  const keyDownUp = ({ type, keyCode }) => {
    controller.keyDownUp(type, keyCode);
  };

  window.addEventListener("keydown", keyDownUp);
  window.addEventListener("keyup", keyDownUp);
  window.addEventListener("resize", resize);

  const leftMouse = new MouseInput("leftBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 37);
  });
  const rightMouse = new MouseInput("rightBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 39);
  });
  const upMouse = new MouseInput("jumpBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 32);
  });

  const clearMouse = () => {
    upMouse.actions.clear();
    leftMouse.actions.clear();
    rightMouse.actions.clear();
  };

  startBtn.onclick = () => {
    clearMouse();
    startTitle.textContent = "";
    toggleStartScreen(false);

    game.world.player.reset();
    game.over = false;

    engine.hold();

    areaId = 1;

    setupWorld();
    setupScreen();

    resize();

    engine.resume();

    if (!engine.started) {
      engine.start();
    }
  };

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      game.world.playThemeMusic();
    } else {
      game.world.pauseThemeMusic();
    }
  });

  // startBtn.click();
});
