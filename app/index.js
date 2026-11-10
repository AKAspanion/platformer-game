import Game from "./game";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";
import MouseInput from "./controller/mouse-input";

import {
  uid,
  getData,
  getAreaNumber,
  LEVELS,
  setData,
  populateHelp,
  populateLinks,
  populatePortals,
  preLoadAndFetch,
} from "./util";

preLoadAndFetch();
populateLinks();
populateHelp();

import areas from "./areas";

let loadingActive = false;
let controllerActive = false;
const isTouchesEnabled = "ontouchstart" in document.documentElement;

const helpBtn = document.getElementById("helpBtn");
const infoBtn = document.getElementById("infoBtn");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
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
const persistentControllers = document.querySelectorAll(".persistent-controller");

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
      (controller.style.visibility = isTouchesEnabled && value ? "visible" : "hidden"),
  );
  persistentControllers.forEach(
    (controller) => (controller.style.visibility = value ? "visible" : "hidden"),
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

const toggleRetryBtn = (value) => {
  retryBtn.style.display = value ? "flex" : "none";
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

  let areaId = 1;
  let loaded = false;
  let paused = false;
  let areaNumber = 1;
  let worldChanged = false;
  let retryLevel = null; // level to restart from after Game Over

  toggleSoundBtn(getData("mute_sounds"));
  toggleMusicBtn(getData("mute_music"));
  clearInterval(loadInterval);
  toggleLoadingScreen(false);
  setProgressValue(0);

  const controller = new Controller();

  // GAME
  const game = new Game((score) => {
    startTitle.textContent = "Game Over";
    scoreTitle.textContent = `Score: ${score} · Area ${areaNumber}`;
    retryLevel = LEVELS.find(({ id }) => id === areaId) || null;

    const savedScore = getData("high_score") || 0;
    const highScore = savedScore < score ? score : savedScore;
    setData("high_score", savedScore < score ? score : savedScore);

    if (highScore) {
      document.getElementById("highScore").innerHTML = `High Score: ${highScore}`;
    }

    setTimeout(() => {
      toggleRetryBtn(!!retryLevel);
      toggleStartScreen(true);
    }, 1500);
  });

  const setupWorld = () => {
    game.world.setup(areas[areaId]);
  };

  // SCREEN
  let screen;

  // resize game window
  const resize = () => {
    let width = document.documentElement.clientWidth;
    let height = document.documentElement.clientHeight;
    let gWidth = game.world.width;
    let gHeight = game.world.height;

    if (width <= 480) {
      [width, height] = [height, width];
      [gWidth, gHeight] = [gHeight, gWidth];
    }

    screen.resize(width, height, game.world.width, game.world.height);
    screen.render();
  };

  const setupScreen = () => {
    screen = new Screen(document.querySelector("canvas"), areas[areaId].world);

    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
    resize();
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

  // update game logic
  const update = () => {
    loaded = isLoaded();
    const loadValue = loadPercent();

    const { player, portal } = game.world;

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
      if (controller.left.active) {
        player.moveLeft();
      }
      if (controller.right.active) {
        player.moveRight();
      }
      if (controller.up.active) {
        if (!player.jumping) {
          game.world.playJumpSound();
          game.world.playerJumped();
        }
        player.jump();
        controller.up.active = false;
      }
      if (controller.fire.active && !player.firing) {
        game.world.shootFireball(uid());
        controller.fire.active = false;
      }
    }

    if (portal) {
      worldChanged = true;
      engine.hold();

      const { destinationArea } = portal;
      areaNumber = getAreaNumber(destinationArea);

      areaId = destinationArea;

      setupWorld();
      setupScreen();

      engine.resume();
    }

    // Pause freezes the world too, not just input: otherwise a player paused
    // mid-jump keeps falling (and can die) behind the pause menu.
    if (!paused) {
      game.update();
    }
  };

  // render assets
  const render = () => {
    screen.drawBackground();

    // screen shake moves the world, not the background or the HUD
    const shake = game.world.effects.offset;
    screen.buffer.save();
    screen.buffer.translate(shake.x, shake.y);

    const {
      map,
      coins,
      water,
      player,
      columns,
      objects,
      enemies,
      fireballs,
      totalCoins,
      totalEnemies,
    } = game.world;

    // draw water animations
    if (water) {
      for (let index = 0; index < water.items.length; index++) {
        const waterItem = water.items[index];

        screen.drawObject(
          waterItem.animator.frameValue,
          waterItem.x,
          waterItem.y,
          waterItem.width,
          waterItem.height,
          waterItem.offsetX,
          waterItem.offsetY,
        );
      }
    }

    screen.drawMap(map);
    screen.drawMapObjects(objects);
    // screen.drawArea(game.world.portals);
    // screen.drawArea(game.world.deathAreas);
    // screen.drawArea(game.world.enemies.items);

    // draw coins
    if (coins) {
      for (let index = 0; index < coins.items.length; index++) {
        const coin = coins.items[index];

        screen.drawObject(
          coin.animator.frameValue,
          coin.x,
          coin.y,
          coin.width,
          coin.height,
          coin.offsetX,
          coin.offsetY,
        );
        // screen.drawText(coin.id, coin.x, coin.y);
        // screen.drawRect(coin);
      }
    }

    // draw fireballs
    if (fireballs) {
      for (let index = 0; index < fireballs.items.length; index++) {
        const fireball = fireballs.items[index];

        screen.drawObject(
          fireball.animator.frameValue,
          fireball.x,
          fireball.y,
          fireball.width,
          fireball.height,
        );
      }
    }

    // draw enemies
    if (enemies) {
      for (let index = 0; index < enemies.items.length; index++) {
        const enemy = enemies.items[index];
        const rect = enemy.drawRect();

        screen.drawObject(enemy.animator.frameValue, rect.x, rect.y, rect.width, rect.height);
      }
    }

    // draw player
    const dead = game.world.isPlayerDead;
    const deadOffset = dead ? (player.direction < 0 ? 12 : -12) : 0;
    const xOffset = player.direction < 0 ? -36 + deadOffset : -12 + deadOffset;
    screen.drawPlayer(
      player.animator.frameValue,
      player.getLeft(),
      player.getTop(),
      60,
      40,
      xOffset,
      -24,
    );

    game.world.effects.draw(screen.buffer);
    screen.buffer.restore();

    // draw coin count
    const image = coins.frameSets.coin[0];
    const coinTextOffest = totalCoins >= 10 && totalCoins <= 99 ? 3 : totalCoins > 99 ? 3.4 : 2.7;

    screen.drawObject(image, (columns - 1.3) * 16, 8, 10, 10);
    screen.drawText("x", (columns - 2) * 16, 15);
    screen.drawText(totalCoins, (columns - coinTextOffest) * 16, 16.1);

    screen.drawText(areaNumber, 48, 15.3);
    screen.drawText("Area", 12, 15.3);
    screen.drawText("x", 38, 15);

    const score = totalEnemies * 100 + totalCoins * 20;
    const scoreTextOffest = score >= 10 && score <= 99 ? 3 : score > 99 ? 3.4 : 2.7;
    screen.drawText(score, (columns - scoreTextOffest) * 9, 15.3);

    screen.render();
  };

  resize();

  var engine = new GameEngine(1000 / 30, update, render);

  // ?debug exposes the game for manual testing from the console
  if (new URLSearchParams(window.location.search).has("debug")) {
    window.debugGame = { game, engine, controller, loadWorld: (...args) => loadWorld(...args) };
  }

  // EVENTS HANDLER
  const isVisible = (el) => getComputedStyle(el).visibility === "visible";
  const isPlaying = () => engine.started && !game.over && !paused;
  const isMenuOpen = () =>
    isVisible(helpScreen) || isVisible(infoScreen) || isVisible(portalScreen);

  const keyDownUp = ({ type, keyCode }) => {
    if (type === "keydown") {
      // Esc / P: pause, or resume from the pause screen
      if (keyCode === 27 || keyCode === 80) {
        if (isPlaying()) pauseBtn.onclick();
        else if (paused && !isMenuOpen()) startBtn.click();
        return;
      }
      // Enter on the start / pause / game-over screen: play, resume, or retry
      if (keyCode === 13 && isVisible(startScreen) && !isMenuOpen()) {
        (retryLevel ? retryBtn : startBtn).click();
        return;
      }
    }
    controller.keyDownUp(type, keyCode);
  };

  window.addEventListener("keydown", keyDownUp);
  window.addEventListener("keyup", keyDownUp);
  // a key released while the window is unfocused never sends keyup
  window.addEventListener("blur", () => controller.releaseAll());
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

  const loadWorld = (id = 1, areaNum = 1, left = 40, top = 100, refresh = false) => {
    clearMouse();
    startTitle.textContent = "";
    scoreTitle.textContent = "";
    retryLevel = null;
    toggleRetryBtn(false);
    toggleStartScreen(false);

    const start = () => {
      game.world.reset();
      game.over = false;

      engine.hold();

      game.world.player.setLeft(left);
      game.world.player.setTop(top);

      areaId = id;
      areaNumber = areaNum;

      setupWorld();
      setupScreen();

      resize();

      engine.resume();
    };

    if (paused) {
      paused = false;

      game.world.playThemeMusic();
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

  const onPortalClick = ({ id, areaNum, left, top }) => {
    togglePortalScreen(false);
    loadWorld(id, areaNum, left, top, true);
  };

  populatePortals(onPortalClick);

  startBtn.onclick = () => {
    loadWorld();
  };

  // Restart the area the player died in (score resets, as on any restart).
  retryBtn.onclick = () => {
    if (!retryLevel) return;
    const { id, areaNum, left, top } = retryLevel;
    loadWorld(id, areaNum, left, top);
  };

  pauseBtn.onclick = () => {
    clearMouse();
    toggleStartScreen(true);

    game.world.pauseThemeMusic();
    startBtn.textContent = "resume";

    paused = true;
  };

  refreshBtn.onclick = () => {
    areaNumber = 1;
    startBtn.click();
  };

  soundBtn.onclick = () => {
    const isMuted = !getData("mute_sounds");

    setData("mute_sounds", isMuted);
    toggleSoundBtn(isMuted);
  };

  musicBtn.onclick = () => {
    const isMuted = !getData("mute_music");

    setData("mute_music", isMuted);
    toggleMusicBtn(isMuted);
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
    } else if (isPlaying()) {
      pauseBtn.onclick();
    } else {
      game.world.pauseThemeMusic();
    }
  });

  // startBtn.click();
});
