import Game from "./game";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";
import MouseInput from "./controller/mouse-input";

import { setRandomInterval, randomIntFromInterval } from "./util";

import {
  uid,
  getData,
  setData,
  populateHelp,
  populateLinks,
  preLoadAndFetch,
} from "./util";

preLoadAndFetch();
populateLinks();
populateHelp();

let loadingActive = false;
let controllerActive = false;
const isTouchesEnabled = "ontouchstart" in document.documentElement;

const helpBtn = document.getElementById("helpBtn");
const infoBtn = document.getElementById("infoBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");
const musicBtn = document.getElementById("musicBtn");
const portalBtn = document.getElementById("portalBtn");
const helpScreen = document.getElementById("helpScreen");
const helpCloseBtn = document.getElementById("helpCloseBtn");
const portalScreen = document.getElementById("portalScreen");
const portalCloseBtn = document.getElementById("portalCloseBtn");
const infoScreen = document.getElementById("infoScreen");
const infoCloseBtn = document.getElementById("infoCloseBtn");
const refreshBtn = document.getElementById("refreshBtn");
const startTitle = document.getElementById("startTitle");
const scoreTitle = document.getElementById("scoreTitle");
const startScreen = document.getElementById("startScreen");
const controllers = document.querySelectorAll(".controller");
const loadingScreen = document.getElementById("loadingScreen");
const progressValue = document.getElementById("progressValue");
const persistentControllers = document.querySelectorAll(
  ".persistent-controller"
);

const toggleSoundBtn = (value) => {
  soundBtn.classList[value ? "add" : "remove"]("cancel-cross");
};

const toggleMusicBtn = (value) => {
  musicBtn.classList[value ? "add" : "remove"]("cancel-cross");
};

const toggleControllers = (value) => {
  controllerActive = value;
  controllers.forEach(
    (controller) =>
      (controller.style.visibility =
        isTouchesEnabled && value ? "visible" : "hidden")
  );
  persistentControllers.forEach(
    (controller) => (controller.style.visibility = value ? "visible" : "hidden")
  );
};

const togglePortalScreen = (value) => {
  portalScreen.style.visibility = !value ? "hidden" : "visible";
};

const toggleHelpScreen = (value) => {
  helpScreen.style.visibility = !value ? "hidden" : "visible";
};

const toggleInfoScreen = (value) => {
  infoScreen.style.visibility = !value ? "hidden" : "visible";
};

const toggleStartScreen = (value) => {
  startScreen.style.visibility = !value ? "hidden" : "visible";
};

const toggleLoadingScreen = (value) => {
  loadingActive = value;
  loadingScreen.style.visibility = !value ? "hidden" : "visible";
};

const setProgressValue = (value) => {
  progressValue.style.width = `${value}%`;
};

window.addEventListener("load", function () {
  "use strict";

  let interval;
  let loaded = false;
  let paused = false;

  toggleSoundBtn(getData("mute_sounds"));
  toggleMusicBtn(getData("mute_music"));
  clearInterval(loadInterval);
  toggleLoadingScreen(false);
  setProgressValue(0);

  const controller = new Controller();

  // GAME
  const game = new Game((score) => {
    startTitle.textContent = "Game Over";
    scoreTitle.textContent = "Score: " + score;

    const savedScore = getData("high_score") || 0;
    const highScore = savedScore < score ? score : savedScore;
    setData("high_score", savedScore < score ? score : savedScore);

    if (highScore) {
      document.getElementById(
        "highScore"
      ).innerHTML = `High Score: ${highScore}`;
    }

    setTimeout(() => {
      toggleStartScreen(true);
    }, 1500);
  });

  const setupWorld = () => {
    game.world.setup();
  };

  // SCREEN
  let screen;

  const setupScreen = () => {
    screen = new Screen(document.querySelector("canvas"));

    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
  };

  setupScreen();

  // GAME ENGINE
  const loadPercent = () => {
    const totalAssets = game.world.assetCount + screen.assetCount;
    const totalLoaded = game.world.loadCount + screen.loadCount;

    return Math.round((totalLoaded / totalAssets) * 100);
  };

  const isLoaded = () => {
    return game.isLoaded() && screen.isLoaded();
  };

  // update game logic
  const update = () => {
    loaded = isLoaded();
    const loadValue = loadPercent();

    const { dino } = game.world;

    if (loadValue < 100) {
      setProgressValue(loadValue == 99 ? 100 : loadValue);
    }

    if (!loaded) {
      if (controllerActive) {
        toggleControllers(false);
      }
      if (!loadingActive) {
        toggleLoadingScreen(true);
      }
    } else {
      if (loadingActive) {
        toggleLoadingScreen(false);
        setProgressValue(0);
      }
      if (!controllerActive) {
        toggleControllers(true);
      }
    }

    if (!game.over && loaded && !paused) {
      dino.duck(controller.down.active);

      if (controller.up.active) {
        if (!dino.jumping) {
          game.world.playJumpSound();
        }
        dino.jump();
        controller.up.active = false;
      }
    }

    game.update();
  };

  // render assets
  const render = () => {
    screen.drawBackground();

    const { dino, birds, cactuses } = game.world;

    // screen.drawRect(dino);

    screen.drawDino(
      dino.animator.frameValue,
      dino.getLeft(),
      dino.getTop(),
      dino.getRenderWidth(),
      dino.getRenderHeight(),
      0,
      dino.getOffset()
    );

    if (cactuses) {
      for (let index = 0; index < cactuses.items.length; index++) {
        const cactus = cactuses.items[index];

        screen.drawObject(
          cactus.animator.frameValue,
          cactus.x,
          cactus.y,
          cactus.width,
          cactus.height
        );
      }
    }

    // birds
    if (birds) {
      for (let index = 0; index < birds.items.length; index++) {
        const bird = birds.items[index];

        screen.drawObject(
          bird.animator.frameValue,
          bird.x,
          bird.y,
          bird.width,
          bird.height
        );
      }
    }

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

  const fireMouse = new MouseInput("fireBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 13);
  });

  const clearMouse = () => {
    upMouse.actions.clear();
    fireMouse.actions.clear();
    leftMouse.actions.clear();
    rightMouse.actions.clear();
  };

  const loadWorld = (refresh = false) => {
    clearMouse();
    startTitle.textContent = "";
    scoreTitle.textContent = "";
    toggleStartScreen(false);

    const start = () => {
      game.world.reset();
      game.over = false;

      engine.hold();

      game.world.dino.run();

      setupWorld();
      setupScreen();

      resize();

      if (interval && interval.clear) {
        interval.clear();
      }

      interval = setRandomInterval(
        () => {
          if (!game.over && loaded && !paused) {
            const { birds, cactuses, width, height } = game.world;

            const chance = randomIntFromInterval(1, 2);

            if (chance === 1) {
              birds.add(uid(), width + 50, height);
            } else {
              cactuses.add(uid(), width + 50, height);
            }
            controller.fire.active = false;
          }
        },
        1000,
        3000
      );

      engine.resume();
    };

    if (paused) {
      paused = false;

      startBtn.textContent = "play";

      if (refresh) {
        start();
      }
    } else {
      start();
    }

    if (!engine.started) {
      engine.start();
    }
  };

  startBtn.onclick = () => {
    loadWorld();
  };

  pauseBtn.onclick = () => {
    clearMouse();
    toggleStartScreen(true);

    game.world.pauseThemeMusic();
    startBtn.textContent = "resume";

    paused = true;
  };

  refreshBtn.onclick = () => {
    startBtn.click();
  };

  portalBtn.onclick = () => {
    togglePortalScreen(true);
  };

  helpBtn.onclick = () => {
    toggleHelpScreen(true);
  };

  helpCloseBtn.onclick = () => {
    toggleHelpScreen(false);
  };

  portalCloseBtn.onclick = () => {
    togglePortalScreen(false);
  };

  infoBtn.onclick = () => {
    toggleInfoScreen(true);
  };

  infoCloseBtn.onclick = () => {
    toggleInfoScreen(false);
  };

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (!paused) {
        game.world.playThemeMusic();
      }
    } else {
      game.world.pauseThemeMusic();
    }
  });

  loadWorld();
});
