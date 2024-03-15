/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./app/areas/index.js":
/*!****************************!*\
  !*** ./app/areas/index.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _area_1_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./area-1.json */ "./app/areas/area-1.json");
/* harmony import */ var _area_2_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./area-2.json */ "./app/areas/area-2.json");
/* harmony import */ var _area_3_json__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./area-3.json */ "./app/areas/area-3.json");
/* harmony import */ var _area_4_json__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./area-4.json */ "./app/areas/area-4.json");
/* harmony import */ var _area_5_json__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./area-5.json */ "./app/areas/area-5.json");
/* harmony import */ var _area_6_json__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./area-6.json */ "./app/areas/area-6.json");
/* harmony import */ var _area_7_json__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./area-7.json */ "./app/areas/area-7.json");
/* harmony import */ var _area_8_json__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./area-8.json */ "./app/areas/area-8.json");








/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  [_area_1_json__WEBPACK_IMPORTED_MODULE_0__.id]: _area_1_json__WEBPACK_IMPORTED_MODULE_0__,
  [_area_2_json__WEBPACK_IMPORTED_MODULE_1__.id]: _area_2_json__WEBPACK_IMPORTED_MODULE_1__,
  [_area_3_json__WEBPACK_IMPORTED_MODULE_2__.id]: _area_3_json__WEBPACK_IMPORTED_MODULE_2__,
  [_area_3_json__WEBPACK_IMPORTED_MODULE_2__.id]: _area_3_json__WEBPACK_IMPORTED_MODULE_2__,
  [_area_4_json__WEBPACK_IMPORTED_MODULE_3__.id]: _area_4_json__WEBPACK_IMPORTED_MODULE_3__,
  [_area_5_json__WEBPACK_IMPORTED_MODULE_4__.id]: _area_5_json__WEBPACK_IMPORTED_MODULE_4__,
  [_area_6_json__WEBPACK_IMPORTED_MODULE_5__.id]: _area_6_json__WEBPACK_IMPORTED_MODULE_5__,
  [_area_7_json__WEBPACK_IMPORTED_MODULE_6__.id]: _area_7_json__WEBPACK_IMPORTED_MODULE_6__,
  [_area_8_json__WEBPACK_IMPORTED_MODULE_7__.id]: _area_8_json__WEBPACK_IMPORTED_MODULE_7__
});


/***/ }),

/***/ "./app/controller/audio.js":
/*!*********************************!*\
  !*** ./app/controller/audio.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AudioController)
/* harmony export */ });
/* harmony import */ var _util___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/ */ "./app/util/index.js");

class AudioController {
  constructor() {
    this.count = 4;
    this.audios = {};
  }
  static play(key, ext = "wav", volume = 0.4) {
    if ((0,_util___WEBPACK_IMPORTED_MODULE_0__.getData)("mute_sounds"))
      return;
    const audio = new Audio(`./assets/audio/${key}.${ext}`);
    audio.volume = volume;
    audio.play();
  }
  play(key, ext = "wav") {
    try {
      if (!this.audios[key]) {
        this.audios[key] = new Audio(`./assets/audio/${key}.${ext}`);
      }
      this.audios[key].volume = 0.4;
      if ((0,_util___WEBPACK_IMPORTED_MODULE_0__.getData)("mute_music"))
        return;
      this.audios[key].play();
    } catch (error) {
    }
    return this;
  }
  load(audios = [], loaded) {
    const filteredAudios = audios.filter(({ file }) => !this.audios[file]);
    if (!filteredAudios.length) {
      loaded(true);
      return;
    }
    loaded(false);
    let done = 0;
    const onload = () => {
      done += 1;
      if (filteredAudios.length === done) {
        loaded(true);
      }
    };
    audios.forEach(({ file, ext = "mp3" }) => {
      this.audios[file] = new Audio();
      this.audios[file].addEventListener("canplaythrough", onload, false);
      this.audios[file].src = `./assets/audio/${file}.${ext}`;
      this.audios[file].volume = 0.5;
    });
  }
  loop(key) {
    if (this.audios[key]) {
      this.audios[key].loop = true;
    }
  }
  pause(key) {
    if (this.audios[key]) {
      this.audios[key].pause();
    }
  }
  stop(key) {
    if (this.audios[key]) {
      this.pause(key);
      this.audios[key].currentTime = 0;
    }
  }
  volume(key, value) {
    if (this.audios[key]) {
      this.audios[key].volume = value / 100;
    }
  }
  static animate(callback, go = false, delay = 12) {
    if (go) {
      this.count++;
      while (this.count > delay) {
        this.count -= delay;
        callback();
      }
    } else {
      this.count = 4;
    }
  }
}


/***/ }),

/***/ "./app/controller/index.js":
/*!*********************************!*\
  !*** ./app/controller/index.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Controller)
/* harmony export */ });
/* harmony import */ var _input__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./input */ "./app/controller/input.js");

class Controller {
  constructor() {
    this.up = new _input__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.left = new _input__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.right = new _input__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.fire = new _input__WEBPACK_IMPORTED_MODULE_0__["default"]();
  }
  keyDownUp(type, keyCode) {
    let down = type == "keydown" ? true : false;
    switch (keyCode) {
      case 37:
      case 65:
        this.left.getInput(down);
        break;
      case 38:
      case 32:
        this.up.getInput(down);
        break;
      case 39:
      case 68:
        this.right.getInput(down);
        break;
      case 13:
      case 16:
        this.fire.getInput(down);
    }
  }
}


/***/ }),

/***/ "./app/controller/input.js":
/*!*********************************!*\
  !*** ./app/controller/input.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Input)
/* harmony export */ });
class Input {
  constructor() {
    this.down = false;
    this.active = false;
  }
  getInput(down) {
    if (this.down != down)
      this.active = down;
    this.down = down;
  }
}


/***/ }),

/***/ "./app/controller/mouse-input.js":
/*!***************************************!*\
  !*** ./app/controller/mouse-input.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MouseInput)
/* harmony export */ });
class MouseInput {
  constructor(id, action) {
    this.actions = this.holdit(document.getElementById(id), action, 1e3, 2);
  }
  holdit(btn, action, start, speedup) {
    let timeout;
    const clear = () => {
      clearTimeout(timeout);
    };
    const preventDefault = (e) => {
      if (e.preventDefault) {
        e.preventDefault();
      }
    };
    const repeat = function() {
      action("keydown");
      timeout = setTimeout(repeat, start);
      start = start / speedup;
    };
    try {
      btn.ontouchstart = function(e) {
        preventDefault(e);
        repeat();
      };
      btn.ontouchend = function(e) {
        preventDefault(e);
        action("keyup");
        clear();
      };
    } catch (error) {
      console.error("Error in mouse input", error);
    }
    return { clear };
  }
}


/***/ }),

/***/ "./app/engine/index.js":
/*!*****************************!*\
  !*** ./app/engine/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ GameEngine)
/* harmony export */ });
class GameEngine {
  constructor(timeStep, update, render) {
    this.timeStep = timeStep;
    this.update = update;
    this.render = render;
    this.started = false;
    this.pause = false;
    this.updated = false;
    this.time = null;
    this.extraTime = 0;
    this.animationFrameRequest = null;
    this.engineLoop = (t) => this.loop(t);
  }
  loop(timeStamp) {
    if (this.pause) {
      return;
    }
    this.animationFrameRequest = window.requestAnimationFrame(this.engineLoop);
    this.extraTime += timeStamp - this.time;
    this.time = timeStamp;
    if (this.extraTime >= this.timeStep * 3) {
      this.extraTime = this.timeStep;
    }
    while (this.extraTime >= this.timeStep) {
      this.extraTime -= this.timeStep;
      this.update(this.timeStamp);
      this.updated = true;
    }
    if (this.updated) {
      this.updated = false;
      this.render(this.timeStamp);
    }
  }
  start() {
    this.started = true;
    this.extraTime = this.timeStep;
    this.time = window.performance.now();
    this.animationFrameRequest = window.requestAnimationFrame(this.engineLoop);
  }
  stop() {
    window.cancelAnimationFrame(this.animationFrameRequest);
  }
  hold() {
    this.pause = true;
  }
  resume() {
    this.pause = false;
  }
}


/***/ }),

/***/ "./app/game/animator.js":
/*!******************************!*\
  !*** ./app/game/animator.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Animator)
/* harmony export */ });
class Animator {
  constructor(frameSet, delay = 4) {
    this.count = 0;
    this.delay = delay >= 1 ? delay : 1;
    this.frameSet = frameSet;
    this.frameIndex = 0;
    this.frameValue = frameSet[0];
  }
  animate(last) {
    this.loop(last);
  }
  changeFrameSet(frameSet, delay = 4, frameIndex = 0) {
    if (this.frameSet === frameSet) {
      return;
    }
    this.count = 0;
    this.delay = delay;
    this.frameSet = frameSet;
    this.frameIndex = frameIndex;
    this.frameValue = frameSet[frameIndex];
  }
  loop(last) {
    this.count++;
    while (this.count > this.delay) {
      this.count -= this.delay;
      if (last && this.frameIndex === this.frameSet.length - 1) {
        this.frameIndex = this.frameSet.length - 1;
      } else {
        this.frameIndex = this.frameIndex < this.frameSet.length - 1 ? this.frameIndex + 1 : 0;
      }
      this.frameValue = this.frameSet[this.frameIndex];
    }
  }
}


/***/ }),

/***/ "./app/game/coins.js":
/*!***************************!*\
  !*** ./app/game/coins.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ items)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _animator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./animator */ "./app/game/animator.js");


class items {
  constructor(objects = [], tileSize, collectedCoins) {
    this.items = [];
    this.loaded = false;
    const keys = [{ id: "", count: 16 }];
    this.frameSets = {};
    this.assetCount = 16;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.onload = (e) => {
          this.loadCount += 1;
          if (count === this.loadCount) {
            this.loaded = true;
          }
        };
        image.src = `./assets/sprites/coin/image ${index}.webp`;
        const addImage = (k, image2) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image2);
        };
        addImage("coin", image);
      }
    });
    for (let index = 0; index < objects.length; index++) {
      const { id, left, top, offsetX, offsetY } = objects[index];
      if (!collectedCoins.includes(id)) {
        this.items.push(
          new Coin(id, left * tileSize, top * tileSize, offsetX, offsetY, this.frameSets["coin"])
        );
      }
    }
  }
  remove(coin) {
    this.items.splice(this.items.indexOf(coin), 1);
  }
  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].update();
    }
  }
  updateAnimation() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }
}
class Coin extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(id, x, y, offsetX = 3, offsetY = 3, frameSet) {
    super(x, y, 8, 10);
    this.id = id;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.baseX = x;
    this.baseY = y;
    this.positionX = Math.random() * Math.PI * 2;
    this.positionY = this.positionX * 2;
    this.animator = new _animator__WEBPACK_IMPORTED_MODULE_1__["default"](frameSet);
  }
  update() {
    this.positionX += 0.1;
    this.positionY += 0.15;
    this.x = this.baseX + Math.cos(this.positionX) * 1.5;
    this.y = this.baseY + Math.sin(this.positionY);
  }
  updateAnimation() {
    this.animator.animate();
  }
}


/***/ }),

/***/ "./app/game/collider.js":
/*!******************************!*\
  !*** ./app/game/collider.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Collider)
/* harmony export */ });
class Collider {
  collide(value, object, tileX, tileY, tileSize) {
    const router = (direction) => {
      switch (direction) {
        case "t":
          return this.collidePlatformTop(object, tileY);
        case "b":
          return this.collidePlatformBottom(object, tileY + tileSize);
        case "l":
          return this.collidePlatformLeft(object, tileX);
        case "r":
          return this.collidePlatformRight(object, tileX + tileSize);
        default:
          break;
      }
    };
    let flag = false;
    if (typeof value === "string") {
      const keys = value.split("");
      for (let index = 0; index < keys.length; index++) {
        flag = router(keys[index]);
        if (flag) {
          break;
        }
      }
    }
    return flag;
  }
  collidePlatformBottom(object, bottomTile) {
    if (object.getTop() < bottomTile && object.getOldTop() >= bottomTile) {
      object.setTop(bottomTile);
      object.velocityY = 0;
      return true;
    }
    return false;
  }
  collidePlatformLeft(object, leftTile) {
    if (object.getRight() > leftTile && object.getOldRight() <= leftTile) {
      object.setRight(leftTile - 0.01);
      object.velocityX = 0;
      return true;
    }
    return false;
  }
  collidePlatformRight(object, rightTile) {
    if (object.getLeft() < rightTile && object.getOldLeft() >= rightTile) {
      object.setLeft(rightTile);
      object.velocityX = 0;
      return true;
    }
    return false;
  }
  collidePlatformTop(object, topTile) {
    if (object.getBottom() > topTile && object.getOldBottom() <= topTile) {
      object.setBottom(topTile - 0.01);
      object.velocityY = 0;
      object.jumping = false;
      return true;
    }
    return false;
  }
}


/***/ }),

/***/ "./app/game/enemies.js":
/*!*****************************!*\
  !*** ./app/game/enemies.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Enemies)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _animator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./animator */ "./app/game/animator.js");


const enemyTypes = {
  pig: {
    maxV: 0.8,
    minV: 0.5,
    delay: 2,
    width: 21,
    height: 20
  },
  slime: {
    maxV: 0.4,
    minV: 0.2,
    delay: 4,
    width: 23,
    height: 20
  },
  chameleon: {
    maxV: 0.4,
    minV: 0.2,
    delay: 2,
    width: 22,
    height: 20
  }
};
class Enemies {
  constructor(enemies = [], tileSize = 16, killedEnemies = "") {
    this.items = [];
    this.loaded = false;
    const keys = [
      { id: "pig", count: 16 },
      { id: "slime", count: 10 },
      { id: "chameleon", count: 8 }
    ];
    this.frameSets = {};
    this.loadCount = 0;
    this.assetCount = keys.reduce((total, { count }) => total + count * 2, 0);
    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = () => {
          this.loadCount += 1;
          if (this.assetCount === this.loadCount) {
            this.loaded = true;
          }
        };
        const imageLeft = new Image();
        const imageRight = new Image();
        imageLeft.onload = onImgLoad;
        imageRight.onload = onImgLoad;
        imageLeft.src = `./assets/sprites/enemies/${id}/left/image_part_0${index}.png`;
        imageRight.src = `./assets/sprites/enemies/${id}/right/image_part_0${index}.png`;
        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };
        addImage(`${id}Left`, imageLeft);
        addImage(`${id}Right`, imageRight);
      }
    });
    for (let index = 0; index < enemies.length; index++) {
      const { id, type, left, top, sway, dir } = enemies[index];
      if (!killedEnemies.includes(id)) {
        this.items.push(
          new Enemy(
            id,
            type,
            left * tileSize,
            top * tileSize,
            [this.frameSets[`${type}Left`], this.frameSets[`${type}Right`]],
            sway,
            dir
          )
        );
      }
    }
  }
  remove(enemy) {
    this.items.splice(this.items.indexOf(enemy), 1);
  }
  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].update();
    }
  }
  updateAnimation() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }
}
class Enemy extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(id, type, x, y, frameSets, sway = 24, direction = 1) {
    const { width = 20, height = 20, delay = 2, maxV = 0.8, minV = 0.5 } = enemyTypes[type] || {};
    super(x, y - 4, width, height);
    this.id = id;
    this.sway = sway;
    this.frameSets = frameSets;
    this.baseX = x;
    this.baseY = y;
    this.delay = delay;
    this.direction = direction;
    this.velocity = Math.random() * (maxV - minV) + minV;
    this.animator = new _animator__WEBPACK_IMPORTED_MODULE_1__["default"](frameSets[direction < 0 ? 0 : 1], delay);
  }
  update() {
    this.x += this.velocity * this.direction;
    if (this.x > this.baseX + this.sway) {
      this.direction = -1;
      this.animator.changeFrameSet(this.frameSets[0], this.delay);
    } else if (this.x <= this.baseX - this.sway) {
      this.direction = 1;
      this.animator.changeFrameSet(this.frameSets[1], this.delay);
    }
  }
  updateAnimation() {
    this.animator.animate();
  }
}


/***/ }),

/***/ "./app/game/fireballs.js":
/*!*******************************!*\
  !*** ./app/game/fireballs.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Fireballs)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _animator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./animator */ "./app/game/animator.js");


class Fireballs {
  constructor() {
    this.items = [];
    this.loaded = false;
    this.frameSets = {};
    const keys = [{ id: "", count: 5 }];
    this.assetCount = 10;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = () => {
          this.loadCount += 1;
          if (this.assetCount === this.loadCount) {
            this.loaded = true;
          }
        };
        const imageLeft = new Image();
        imageLeft.onload = onImgLoad;
        imageLeft.src = `./assets/sprites/fireball/left/image ${index}.webp`;
        const imageRight = new Image();
        imageRight.onload = onImgLoad;
        imageRight.src = `./assets/sprites/fireball/right/image ${index}.webp`;
        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };
        addImage("fireballLeft", imageLeft);
        addImage("fireballRight", imageRight);
      }
    });
  }
  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].update();
    }
  }
  updateAnimation() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }
  add(id, x, y, direction) {
    this.items.push(
      new Fireball(
        id,
        x,
        y,
        direction,
        this.frameSets[`fireball${direction < 0 ? "Left" : "Right"}`]
      )
    );
  }
  remove(fireball) {
    this.items.splice(this.items.indexOf(fireball), 1);
  }
  reset() {
    this.items = [];
  }
}
class Fireball extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(id, x, y, direction, frameSet) {
    super(x, y, 32, 16);
    this.id = id;
    this.direction = direction;
    this.velocity = 5;
    this.animator = new _animator__WEBPACK_IMPORTED_MODULE_1__["default"](frameSet);
  }
  update() {
    if (this.direction < 0) {
      this.x -= this.velocity;
    } else {
      this.x += this.velocity;
    }
  }
  updateAnimation() {
    this.animator.animate();
  }
}


/***/ }),

/***/ "./app/game/index.js":
/*!***************************!*\
  !*** ./app/game/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Game)
/* harmony export */ });
/* harmony import */ var _world__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./world */ "./app/game/world.js");

class Game {
  constructor(gameOverCallback) {
    this.world = new _world__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this.over = false;
    this.onGameOver = () => {
      this.over = true;
      gameOverCallback(this.world.totalEnemies * 100 + this.world.totalCoins * 20);
    };
  }
  isLoaded() {
    return this.world.isLoaded();
  }
  update() {
    this.world.update(this.onGameOver);
  }
  setGameOver(val) {
    this.over = val;
  }
}


/***/ }),

/***/ "./app/game/object.js":
/*!****************************!*\
  !*** ./app/game/object.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Object)
/* harmony export */ });
class Object {
  constructor(x, y, width, height) {
    this.height = height;
    this.width = width;
    this.x = x;
    this.xOld = x;
    this.y = y;
    this.yOld = y;
  }
  getBottom() {
    return this.y + this.height;
  }
  getLeft() {
    return this.x;
  }
  getRight() {
    return this.x + this.width;
  }
  getTop() {
    return this.y;
  }
  getOldBottom() {
    return this.yOld + this.height;
  }
  getOldLeft() {
    return this.xOld;
  }
  getOldRight() {
    return this.xOld + this.width;
  }
  getOldTop() {
    return this.yOld;
  }
  getCenterX() {
    return this.x + this.width * 0.5;
  }
  getCenterY() {
    return this.y + this.height * 0.5;
  }
  setBottom(y) {
    this.y = y - this.height;
  }
  setLeft(x) {
    this.x = x;
  }
  setRight(x) {
    this.x = x - this.width;
  }
  setTop(y) {
    this.y = y;
  }
  setOldBottom(y) {
    this.yOld = y - this.height;
  }
  setOldLeft(x) {
    this.xOld = x;
  }
  setOldRight(x) {
    this.xOld = x - this.width;
  }
  setOldTop(y) {
    this.yOld = y;
  }
  setCenterX(x) {
    this.x = x - this.width * 0.5;
  }
  setCenterY(y) {
    this.y = y - this.height * 0.5;
  }
}


/***/ }),

/***/ "./app/game/player.js":
/*!****************************!*\
  !*** ./app/game/player.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Player)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _animator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./animator */ "./app/game/animator.js");


class Player extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(40, 100, 12, 12);
    this.color = "#ff0000";
    this.loaded = false;
    this.running = false;
    this.jumping = true;
    this.firing = true;
    this.velocityX = 0;
    this.velocityY = 0;
    this.direction = 1;
    const keys = [
      { id: "Idle", count: 10 },
      { id: "Run", count: 8 },
      { id: "Jump", count: 8 },
      { id: "Dead", count: 8 },
      { id: "Fire", count: 4 }
    ];
    this.frameSets = {};
    this.loadCount = 0;
    this.assetCount = 38 * 2;
    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = (e) => {
          this.loadCount += 1;
          if (this.assetCount === this.loadCount) {
            this.loaded = true;
          }
        };
        const imageLeft = new Image();
        imageLeft.onload = onImgLoad;
        const imageRight = new Image();
        imageRight.onload = onImgLoad;
        imageLeft.src = `./assets/sprites/player/left/${id} (${index}).webp`;
        imageRight.src = `./assets/sprites/player/right/${id} (${index}).webp`;
        const keyLeft = `${id.toLowerCase()}Left`;
        const keyRight = `${id.toLowerCase()}Right`;
        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };
        addImage(keyLeft, imageLeft);
        addImage(keyRight, imageRight);
      }
    });
    this.animator = new _animator__WEBPACK_IMPORTED_MODULE_1__["default"](this.frameSets["idleRight"]);
  }
  reset() {
    this.x = 40;
    this.y = 100;
    this.xOld = 40;
    this.yOld = 100;
    this.firing = false;
    this.running = false;
    this.jumping = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.direction = 1;
  }
  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 18;
    }
  }
  fire() {
    if (!this.firing) {
      this.firing = true;
      setTimeout(() => {
        this.firing = false;
      }, 300);
    }
  }
  moveLeft() {
    this.direction = -1;
    this.velocityX -= 0.5;
  }
  moveRight() {
    this.direction = 1;
    this.velocityX += 0.5;
  }
  updateAnimation({ dead = false }) {
    if (dead) {
      if (this.direction < 0)
        this.animator.changeFrameSet(this.frameSets["deadLeft"], 2);
      else
        this.animator.changeFrameSet(this.frameSets["deadRight"], 2);
      this.animator.animate(dead);
      return;
    }
    if (this.velocityY < 0) {
      if (this.direction < 0) {
        this.animator.changeFrameSet(this.frameSets["jumpLeft"], 2);
      } else {
        this.animator.changeFrameSet(this.frameSets["jumpRight"], 2);
      }
    } else if (this.direction < 0) {
      if (this.velocityX < -0.1) {
        this.animator.changeFrameSet(this.frameSets["runLeft"]);
      } else {
        if (this.firing) {
          this.animator.changeFrameSet(this.frameSets["fireLeft"], 2);
        } else {
          this.animator.changeFrameSet(this.frameSets["idleLeft"]);
        }
      }
    } else if (this.direction > 0) {
      if (this.velocityX > 0.1) {
        this.animator.changeFrameSet(this.frameSets["runRight"]);
      } else {
        if (this.firing) {
          this.animator.changeFrameSet(this.frameSets["fireRight"], 2);
        } else {
          this.animator.changeFrameSet(this.frameSets["idleRight"]);
        }
      }
    }
    this.animator.animate();
  }
  update(gravity, friction) {
    this.xOld = this.x;
    this.yOld = this.y;
    this.velocityY += gravity;
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.velocityX *= friction;
    this.velocityY *= friction;
    const absVelocityX = Math.abs(this.velocityX);
    this.running = absVelocityX === 0.435 ? false : absVelocityX >= 0.2;
  }
}


/***/ }),

/***/ "./app/game/portal.js":
/*!****************************!*\
  !*** ./app/game/portal.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Portal)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");

class Portal extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor({ x, y, width, height, direction, destinationX, destinationY, destinationArea }) {
    super(x, y, width, height);
    this.direction = direction;
    this.destinationX = destinationX;
    this.destinationY = destinationY;
    this.destinationArea = destinationArea;
  }
}


/***/ }),

/***/ "./app/game/water.js":
/*!***************************!*\
  !*** ./app/game/water.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Water)
/* harmony export */ });
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _animator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./animator */ "./app/game/animator.js");


class Water {
  constructor(waterObjects = [], tileSize) {
    this.items = [];
    this.loaded = false;
    const keys = [{ id: "", count: 17 }];
    this.frameSets = {};
    this.assetCount = 17;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.onload = () => {
          this.loadCount += 1;
          if (count === this.loadCount) {
            this.loaded = true;
          }
        };
        image.src = `./assets/sprites/water/image ${index}.webp`;
        const addImage = (k, image2) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image2);
        };
        addImage("water", image);
      }
    });
    for (let index = 0; index < waterObjects.length; index++) {
      const { left, top } = waterObjects[index];
      this.items.push(
        new WaterObject(left * tileSize, top * tileSize, this.frameSets["water"], tileSize)
      );
    }
  }
  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }
}
class WaterObject extends _object__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(x, y, frameSet, tileSize) {
    super(x, y, tileSize, tileSize);
    this.animator = new _animator__WEBPACK_IMPORTED_MODULE_1__["default"](frameSet, 3);
  }
  updateAnimation() {
    this.animator.animate();
  }
}


/***/ }),

/***/ "./app/game/world.js":
/*!***************************!*\
  !*** ./app/game/world.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ World)
/* harmony export */ });
/* harmony import */ var _coins__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./coins */ "./app/game/coins.js");
/* harmony import */ var _water__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./water */ "./app/game/water.js");
/* harmony import */ var _player__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./player */ "./app/game/player.js");
/* harmony import */ var _object__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./object */ "./app/game/object.js");
/* harmony import */ var _portal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./portal */ "./app/game/portal.js");
/* harmony import */ var _enemies__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./enemies */ "./app/game/enemies.js");
/* harmony import */ var _collider__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./collider */ "./app/game/collider.js");
/* harmony import */ var _fireballs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./fireballs */ "./app/game/fireballs.js");
/* harmony import */ var _controller_audio__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../controller/audio */ "./app/controller/audio.js");









class World {
  constructor(friction = 0.87, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;
    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;
    this.loaded = true;
    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";
    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;
    this.player = new _player__WEBPACK_IMPORTED_MODULE_2__["default"]();
    this.collider = new _collider__WEBPACK_IMPORTED_MODULE_6__["default"]();
    this.fireballs = new _fireballs__WEBPACK_IMPORTED_MODULE_7__["default"]();
    this.audioController = new _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"]();
  }
  setup(data) {
    if (this.theme !== data.theme) {
      if (data.theme) {
        this.playedThemeMusic = false;
        this.audioController.load(
          [
            { file: "fire", ext: "wav" },
            { file: "coin", ext: "wav" },
            { file: "foot", ext: "wav" },
            { file: "jump", ext: "wav" },
            { file: "hurt", ext: "wav" },
            { file: "fall", ext: "mp3" },
            { file: data.theme, ext: "mp3" }
          ],
          (val) => {
            this.loaded = val;
          }
        );
        this.stopThemeMusic();
        this.theme = data.theme;
      }
    }
    this.id = data.id;
    this.map = data.areaMap;
    this.isPlayerDead = false;
    this.objects = data.objectsMap;
    this.collisonMap = data.collisonMap;
    if (data.rows) {
      this.rows = data.rows;
      this.height = this.tileSize * this.rows;
    }
    if (data.columns) {
      this.columns = data.columns;
      this.width = this.tileSize * this.columns;
    }
    this.deathAreas = data.death.map(({ x, y, height, width }) => new _object__WEBPACK_IMPORTED_MODULE_3__["default"](x, y, width, height));
    this.enemies = new _enemies__WEBPACK_IMPORTED_MODULE_5__["default"](data.enemies, this.tileSize, this.killedEnemies);
    this.coins = new _coins__WEBPACK_IMPORTED_MODULE_0__["default"](data.coins, this.tileSize, this.collectedCoins);
    this.portals = data.portals.map((p) => new _portal__WEBPACK_IMPORTED_MODULE_4__["default"](p));
    this.water = new _water__WEBPACK_IMPORTED_MODULE_1__["default"](data.water, this.tileSize);
    this.fireballs.reset();
    if (this.portal) {
      this.player.setCenterX(this.portal.destinationX);
      this.player.setCenterY(this.portal.destinationY);
      this.player.direction = this.portal.direction;
      this.portal = null;
    }
  }
  reset() {
    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";
    this.player.reset();
  }
  playJumpSound() {
    _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play("jump", "wav");
  }
  playFireSound() {
    _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play("fire", "wav");
  }
  playThemeMusic() {
    if (!this.theme)
      return;
    this.audioController.play(this.theme, "mp3");
    this.audioController.volume(this.theme, 8);
    this.audioController.loop(this.theme);
  }
  stopThemeMusic() {
    if (!this.theme)
      return;
    this.audioController.stop(this.theme);
  }
  pauseThemeMusic() {
    if (!this.theme)
      return;
    this.audioController.pause(this.theme);
  }
  collideObject(object) {
    if (object.getLeft() < 0 - this.player.width / 2) {
      object.setLeft(-this.player.width / 2);
      object.velocityX = 0;
    } else if (object.getRight() > this.width + this.player.width / 2) {
      object.setRight(this.width + this.player.width / 2);
      object.velocityX = 0;
    }
    if (object.getTop() < 0 - this.player.height * 2.5) {
      object.setTop(0 - this.player.height * 2.5);
      object.velocityY = 0;
    } else if (object.getBottom() - 1 > this.height) {
      object.setBottom(this.height);
      object.velocityY = 0;
      object.jumping = false;
    }
    let bottom, left, right, top;
    const setTop = () => {
      top = this._normalizeIndex(Math.floor(object.getTop() / this.tileSize), this.rows);
    };
    const setBottom = () => {
      bottom = this._normalizeIndex(Math.floor(object.getBottom() / this.tileSize), this.rows);
    };
    const setLeft = () => {
      left = Math.floor(object.getLeft() / this.tileSize);
    };
    const setRight = () => {
      right = Math.floor(object.getRight() / this.tileSize);
    };
    setTop();
    setLeft();
    this.collider.collide(
      this.collisonMap[top][left],
      object,
      left * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );
    setTop();
    setRight();
    this.collider.collide(
      this.collisonMap[top][right],
      object,
      right * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );
    setBottom();
    setLeft();
    this.collider.collide(
      this.collisonMap[bottom][left],
      object,
      left * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );
    setBottom();
    setRight();
    this.collider.collide(
      this.collisonMap[bottom][right],
      object,
      right * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );
  }
  _normalizeIndex(index, maxIndex) {
    if (index >= maxIndex - 1) {
      return maxIndex - 1;
    } else if (index < 0) {
      return 0;
    }
    return index;
  }
  checkCollision(object1, object2, offsetX = 0, offsetY = 0) {
    if (object1.x < object2.x + object2.width + offsetX && object1.x + object1.width > object2.x - offsetX && object1.y < object2.y + object2.height + offsetY && object1.y + object1.height > object2.y - offsetY) {
      return true;
    }
    return false;
  }
  get assetCount() {
    return this.coins.assetCount + this.water.assetCount + this.player.assetCount + this.enemies.assetCount + this.fireballs.assetCount;
  }
  get loadCount() {
    return this.coins.loadCount + this.water.loadCount + this.player.loadCount + this.enemies.loadCount + this.fireballs.loadCount;
  }
  isLoaded() {
    return this.loaded && this.isAssetsLoaded();
  }
  isAssetsLoaded() {
    return this.coins.loaded && this.water.loaded && this.player.loaded && this.enemies.loaded && this.fireballs.loaded;
  }
  onPlayerDead(onGameOver, audio = "fall") {
    if (!this.isPlayerDead) {
      _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play(audio, "mp3");
      this.player.velocityX = 0;
      this.stopThemeMusic();
      onGameOver();
    }
    this.isPlayerDead = true;
    this.collectedCoins = "";
    this.killedEnemies = "";
    this.theme = null;
  }
  update(onGameOver) {
    _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].animate(() => {
      _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play("foot", "wav", 0.15);
    }, this.player.running);
    if (!this.playedThemeMusic) {
      if (this.isLoaded()) {
        this.playThemeMusic();
        this.playedThemeMusic = true;
      }
    }
    this.player.update(this.gravity, this.friction);
    this.collideObject(this.player);
    for (let index = 0; index < this.coins.items.length; index++) {
      const coin = this.coins.items[index];
      coin.update();
      coin.updateAnimation();
      if (this.checkCollision(this.player, coin, 5, 5)) {
        this.coins.remove(coin);
        this.collectedCoins += `${coin.id},`;
        _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play("coin");
        this.totalCoins += 1;
      }
    }
    for (let index = 0; index < this.fireballs.items.length; index++) {
      const fireball = this.fireballs.items[index];
      fireball.update();
      fireball.updateAnimation(this.player);
      for (let j = 0; j < this.enemies.items.length; j++) {
        const enemy = this.enemies.items[j];
        if (this.checkCollision(enemy, fireball)) {
          this.enemies.remove(enemy);
          this.killedEnemies += `${enemy.id},`;
          this.totalEnemies += 1;
          _controller_audio__WEBPACK_IMPORTED_MODULE_8__["default"].play("hurt");
        }
      }
      if (fireball.x >= this.width + 50) {
        this.fireballs.remove(fireball);
      }
    }
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.deathAreas.length; index++) {
        if (this.checkCollision(this.player, this.deathAreas[index])) {
          this.onPlayerDead(onGameOver);
          break;
        }
      }
    }
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.enemies.items.length; index++) {
        const enemy = this.enemies.items[index];
        if (this.checkCollision(this.player, enemy)) {
          this.onPlayerDead(onGameOver);
          break;
        }
        enemy.update();
        enemy.updateAnimation();
      }
    }
    if (!this.portal) {
      for (let index = 0; index < this.portals.length; index++) {
        if (this.checkCollision(this.player, this.portals[index])) {
          this.portal = this.portals[index];
          break;
        }
      }
    }
    this.player.updateAnimation({ dead: this.isPlayerDead });
    this.water.update();
  }
}


/***/ }),

/***/ "./app/screen/index.js":
/*!*****************************!*\
  !*** ./app/screen/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Screen)
/* harmony export */ });
/* harmony import */ var _tileset__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tileset */ "./app/screen/tileset.js");

class Screen {
  constructor(canvas, world) {
    this.buffer = canvas.getContext("2d");
    this.canvas = canvas;
    this.tileSet = new _tileset__WEBPACK_IMPORTED_MODULE_0__["default"](16, 8, world);
  }
  drawMap(map) {
    const { images, tileSize } = this.tileSet;
    const drawTile = (x, y, value) => {
      const image = images[value];
      let destinationX = x * tileSize;
      let destinationY = y * tileSize;
      this.buffer.drawImage(image, destinationX, destinationY, tileSize, tileSize);
    };
    for (let i = 0; i < map.length; i++) {
      const row = map[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        if (value) {
          if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
              drawTile(j, i, value[index]);
            }
          } else {
            drawTile(j, i, value);
          }
        }
      }
    }
  }
  drawArea(object) {
    for (let index = 0; index < object.length; index++) {
      const { x, y, width, height } = object[index];
      this.buffer.fillRect(x, y, width, height);
    }
  }
  drawMapObjects(objects) {
    const { objectImages, tileSize } = this.tileSet;
    for (let i = 0; i < objects.length; i++) {
      const row = objects[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        if (value) {
          value.forEach((element) => {
            const { id, xOffset = 0, yOffset = 0, width = 16, height = 16 } = element;
            const image = objectImages[id];
            let destinationX = j * tileSize;
            let destinationY = i * tileSize;
            this.buffer.drawImage(
              image,
              destinationX + xOffset,
              destinationY + yOffset,
              width,
              height
            );
          });
        }
      }
    }
  }
  drawBackground() {
    this.buffer.drawImage(
      this.tileSet.tileBackground,
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
  drawPlayer(image, destinationX, destinationY, width, height, offsetX, offsetY, rect) {
    this.drawObject(image, destinationX + offsetX, destinationY + offsetY + 1, width, height);
  }
  drawDino(image, destinationX, destinationY, width, height, offsetX, offsetY, rect) {
    this.drawObject(image, destinationX + offsetX, destinationY + offsetY + 1, width, height);
  }
  drawObject(image, destinationX, destinationY, width, height, offsetX = 0, offsetY = 0) {
    this.buffer.drawImage(image, destinationX + offsetX, destinationY + offsetY, width, height);
  }
  drawRect({ x, y, width, height }) {
    this.buffer.fillRect(x, y, width, height);
  }
  get assetCount() {
    return this.tileSet.assetCount;
  }
  get loadCount() {
    return this.tileSet.loadCount;
  }
  isLoaded() {
    return this.tileSet.loaded;
  }
  getContainSize(parentWidth, parentHeight, childWidth, childHeight) {
    const contains = true;
    const doRatio = childWidth / childHeight;
    const cRatio = parentWidth / parentHeight;
    let width = parentWidth;
    let height = parentHeight;
    if (contains ? doRatio > cRatio : doRatio < cRatio) {
      height = width / doRatio;
    } else {
      width = height * doRatio;
    }
    return [width, height];
  }
  resize(ww, wh, gW, gH) {
    const [width] = this.getContainSize(ww, wh, gW, gH);
    const scale = window.devicePixelRatio;
    document.documentElement.style.setProperty("--canvas-height", gH + "px");
    document.documentElement.style.setProperty("--canvas-width", gW + "px");
    this.canvas.style.height = `var(--canvas-height, ${gH}px)`;
    this.canvas.style.width = `var(--canvas-width, ${gW}px)`;
    this.canvas.height = Math.floor(gH * scale * scale);
    this.canvas.width = Math.floor(gW * scale * scale);
    this.buffer.scale(scale, scale);
    const cssScale = width / gW;
    document.documentElement.style.setProperty("--canvas-scale", cssScale);
    this.canvas.style.transform = `scale(var(--canvas-scale, ${cssScale}))`;
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


/***/ }),

/***/ "./app/screen/tileset.js":
/*!*******************************!*\
  !*** ./app/screen/tileset.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TileSet)
/* harmony export */ });
class TileSet {
  constructor(tileSize, columns, world = 1) {
    const worldKey = `world-${world}`;
    this.loaded = false;
    this.columns = columns;
    this.tileSize = tileSize;
    this.images = [];
    this.images.push(null);
    this.objectImages = [];
    this.objectImages.push(null);
    this.tileBackground = new Image();
    const meta = {
      1: { objectLen: 11, tileLen: 18 },
      2: { objectLen: 10, tileLen: 18 },
      3: { objectLen: 15, tileLen: 16 },
      4: { objectLen: 14, tileLen: 16 },
      5: { objectLen: 12, tileLen: 25 }
    };
    this.loadCount = 0;
    this.assetCount = meta[world].objectLen + meta[world].tileLen + 1;
    const onImgLoad = (e) => {
      this.loadCount += 1;
      if (this.assetCount === this.loadCount) {
        this.loaded = true;
      }
    };
    for (let index = 1; index <= meta[world].objectLen; index++) {
      const image = new Image();
      image.onload = onImgLoad;
      image.src = `./assets/sprites/${worldKey}/objects/${index}.png`;
      this.objectImages.push(image);
    }
    for (let index = 1; index <= meta[world].tileLen; index++) {
      const image = new Image();
      image.onload = onImgLoad;
      image.src = `./assets/sprites/${worldKey}/tiles/${index}.png`;
      this.images.push(image);
    }
    this.tileBackground.src = `./assets/sprites/${worldKey}/bg.png`;
    this.tileBackground.onload = onImgLoad;
  }
}


/***/ }),

/***/ "./app/util/index.js":
/*!***************************!*\
  !*** ./app/util/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getData: () => (/* binding */ getData),
/* harmony export */   populateHelp: () => (/* binding */ populateHelp),
/* harmony export */   populateLinks: () => (/* binding */ populateLinks),
/* harmony export */   populatePortals: () => (/* binding */ populatePortals),
/* harmony export */   preLoadAndFetch: () => (/* binding */ preLoadAndFetch),
/* harmony export */   setData: () => (/* binding */ setData),
/* harmony export */   uid: () => (/* binding */ uid)
/* harmony export */ });
const uid = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
const setData = (key, value) => {
  return localStorage.setItem(key, JSON.stringify(value));
};
const getData = (key) => {
  return JSON.parse(localStorage.getItem(key));
};
const preLoadAndFetch = () => {
  const items = {
    sprites: [
      { rel: "prefetch", key: "world-1", objects: 11, tiles: 18 },
      { rel: "prefetch", key: "world-2", objects: 10, tiles: 18 },
      { rel: "prefetch", key: "world-3", objects: 15, tiles: 16 },
      { rel: "prefetch", key: "world-4", objects: 14, tiles: 16 },
      { rel: "prefetch", key: "world-5", objects: 12, tiles: 25 }
    ],
    player: [
      { rel: "prefetch", key: "Dead", objects: 8 },
      { rel: "prefetch", key: "Idle", objects: 10 },
      { rel: "prefetch", key: "Jump", objects: 8 },
      { rel: "prefetch", key: "Run", objects: 8 }
    ],
    water: [{ rel: "prefetch", objects: 17 }],
    coin: [{ rel: "prefetch", objects: 16 }]
  };
  const body = document.getElementsByTagName("head")[0];
  const append = (href, rel, as = "image") => {
    const item = document.createElement("link");
    item.as = as;
    item.rel = rel;
    item.href = href;
    body.prepend(item);
  };
  items.sprites.forEach(({ rel, key, objects, tiles }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/${key}/objects/${index}.png`, rel);
    }
    for (let index = 1; index <= tiles; index++) {
      append(`./assets/sprites/${key}/tiles/${index}.png`, rel);
    }
    append(`./assets/sprites/${key}/bg.png`, rel);
  });
  items.player.forEach(({ rel, key, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/player/left/${key} (${index}).webp`, rel);
      append(`./assets/sprites/player/right/${key} (${index}).webp`, rel);
    }
  });
  items.water.forEach(({ rel, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/water/image ${index}.webp`, rel);
    }
  });
  items.coin.forEach(({ rel, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/coin/image ${index}.webp`, rel);
    }
  });
  const audioFiles = [
    { rel: "preload", file: "grasslands" },
    { rel: "preload", file: "coin", ext: "wav" },
    { rel: "preload", file: "jump", ext: "wav" },
    { rel: "preload", file: "fall", ext: "mp3" },
    { rel: "preload", file: "iceland" },
    { rel: "preload", file: "desert" },
    { rel: "preload", file: "dungeon" }
  ];
  audioFiles.forEach(({ rel, file, ext = "mp3" }) => {
    if (rel === "preload") {
      const audio = new Audio();
      audio.url = `./assets/audio/${file}.${ext}`;
    } else {
      append(`./assets/audio/${file}.${ext}`, rel, "audio");
    }
  });
};
const populatePortals = (onPortalClick) => {
  const data = [
    { name: "Grassland 1", id: 1, areaNum: 1, left: 40, top: 100, ss: "images/area_1.png" },
    { name: "Grassland 2", id: 2, areaNum: 2, left: 40, top: 100, ss: "images/area_2.png" },
    { name: "Grassland 3", id: 7, areaNum: 3, left: 40, top: 120, ss: "images/area_3.png" },
    { name: "Iceland 1", id: 3, areaNum: 4, left: 48, top: 100, ss: "images/area_4.png" },
    { name: "Iceland 2", id: 8, areaNum: 5, left: 32, top: 20, ss: "images/area_5.png" }
  ];
  const portalsWrapper = document.getElementById("portalsWrapper");
  portalsWrapper.className += "modal-content-wrapper";
  const itemWrapper = document.createElement("div");
  itemWrapper.classList.add("portal-item-wrapper");
  data.forEach((value) => {
    const { name, ss } = value;
    const div = document.createElement("div");
    div.className += "portal-item";
    const title = document.createElement("div");
    title.className += "portal-title";
    title.textContent = name;
    const overlay = document.createElement("div");
    overlay.className += "portal-overlay";
    const img = document.createElement("img");
    img.src = ss;
    img.className += "portal-item portal-img";
    img.addEventListener("click", () => onPortalClick(value));
    div.appendChild(img);
    div.appendChild(overlay);
    div.appendChild(title);
    itemWrapper.appendChild(div);
  });
  portalsWrapper.appendChild(itemWrapper);
};
const populateLinks = () => {
  const links = [
    {
      className: "btn gh-btn social-btn btn-tut",
      style: "margin-left: 0px",
      link: "https://github.com/AKAspanion"
    },
    {
      className: "btn li-btn social-btn btn-tut",
      style: "",
      link: "https://www.linkedin.com/in/spanion/"
    },
    {
      className: "btn in-btn social-btn btn-tut",
      style: "",
      link: "https://www.instagram.com/spanionkumar/"
    },
    {
      className: "btn fb-btn social-btn btn-tut",
      style: "",
      link: "https://www.facebook.com/AKAspanion/"
    }
  ];
  const linksWrapper = document.getElementById("linksWrapper");
  linksWrapper.className += "flex-item";
  links.forEach(({ link, style, className }) => {
    const a = document.createElement("a");
    a.className += className;
    a.target = "_blank";
    a.style = style;
    a.href = link;
    linksWrapper.appendChild(a);
  });
};
const populateHelp = () => {
  const helpItems = [
    {
      name: "Mobile",
      content: [
        {
          items: [
            { className: "btn left-btn btn-tut", text: "to run left" },
            { className: "btn right-btn btn-tut", text: "to run right", notap: true }
          ]
        },
        {
          items: [
            { className: "btn fire-btn btn-tut flex-item", text: "to spit fire", child: "\u26AA\uFE0F" }
          ]
        },
        {
          items: [{ className: "btn jump-btn btn-tut", text: "to jump" }]
        }
      ]
    },
    {
      name: "Desktop",
      content: [
        {
          items: [
            { className: "btn left-key-btn btn-tut key-btn", text: "to run left" },
            { className: "btn right-key-btn btn-tut key-btn", text: "to run right", notap: true }
          ]
        },
        {
          items: [
            { className: "btn fire-key-btn btn-tut flex-item key-btn", text: "to spit fire" }
          ]
        },
        {
          items: [{ className: "btn jump-key-btn btn-tut key-btn", text: "to jump" }]
        }
      ]
    }
  ];
  const helpWrapper = document.getElementById("helpWrapper");
  helpWrapper.className += "modal-content-wrapper";
  helpItems.forEach(({ name, content }) => {
    const modalContent = document.createElement("div");
    modalContent.className += "flex-item modal-content";
    const modalhead = document.createElement("div");
    modalhead.className += "modal-content-head";
    modalhead.textContent = name;
    const modalContentDesc = document.createElement("div");
    modalContentDesc.className += "flex-item modal-content-desc";
    content.forEach(({ items }) => {
      const flexItem = document.createElement("div");
      flexItem.className += "flex-item";
      items.forEach(({ className, text, child, notap }) => {
        if (!notap) {
          flexItem.innerHTML += "Tap";
        }
        const btn = document.createElement("div");
        btn.className = className;
        if (child) {
          btn.textContent = child;
        }
        flexItem.appendChild(btn);
        flexItem.innerHTML += text;
      });
      modalContentDesc.appendChild(flexItem);
    });
    modalContent.appendChild(modalhead);
    modalContent.appendChild(modalContentDesc);
    helpWrapper.appendChild(modalContent);
  });
};


/***/ }),

/***/ "./app/areas/area-1.json":
/*!*******************************!*\
  !*** ./app/areas/area-1.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":1,"world":1,"rows":12,"columns":21,"theme":"grasslands","water":[{"left":6,"top":10},{"left":6,"top":10.5},{"left":6,"top":11},{"left":7,"top":10},{"left":7,"top":10.5},{"left":7,"top":11},{"left":8,"top":10},{"left":8,"top":10.5},{"left":8,"top":11},{"left":9,"top":10},{"left":9,"top":10.5},{"left":9,"top":11},{"left":10,"top":10},{"left":10,"top":10.5},{"left":10,"top":11},{"left":16,"top":10},{"left":16,"top":10.5},{"left":16,"top":11},{"left":17,"top":10},{"left":17,"top":10.5},{"left":17,"top":11},{"left":18,"top":10},{"left":18,"top":10.5},{"left":18,"top":11},{"left":19,"top":10},{"left":19,"top":10.5},{"left":19,"top":11},{"left":20,"top":10},{"left":20,"top":10.5},{"left":20,"top":11}],"coins":[{"id":"2c01","left":3.5,"top":3.9},{"id":"2c02","left":2.2,"top":4.7},{"id":"2c03","left":1.5,"top":6.1},{"id":"2c04","left":1.2,"top":7.5},{"id":"2c05","left":6.2,"top":8.8},{"id":"2c06","left":7.3,"top":7.8},{"id":"2c07","left":8.7,"top":7.8},{"id":"2c08","left":9.8,"top":8.8},{"id":"2c09","left":5.7,"top":3.9},{"id":"2c10","left":7.1,"top":4.3},{"id":"2c11","left":8,"top":5.5},{"id":"2c12","left":7.7,"top":1.7},{"id":"2c13","left":9.55,"top":1.5},{"id":"2c14","left":11.4,"top":1.7},{"id":"2c15","left":16.3,"top":8.7},{"id":"2c16","left":17.2,"top":7.1},{"id":"2c17","left":19,"top":6.7},{"id":"2c18","left":20,"top":4.7},{"id":"2c19","left":18.9,"top":3.1},{"id":"2c20","left":17.3,"top":2.7},{"id":"2c21","left":14.8,"top":2.7},{"id":"2c22","left":13.2,"top":3.4},{"id":"2c23","left":12.5,"top":4.8},{"id":"2c24","left":5.5,"top":0},{"id":"2c25","left":3.7,"top":0.15},{"id":"2c26","left":2.5,"top":1}],"death":[{"x":112,"y":170,"height":32,"width":48},{"x":272,"y":170,"height":32,"width":64}],"portals":[{"x":-8,"y":0,"height":32,"width":8,"direction":-1,"destinationArea":8,"destinationX":330,"destinationY":56},{"x":336,"y":0,"height":48,"width":8,"direction":1,"destinationArea":2,"destinationX":16,"destinationY":24}],"enemies":[{"id":"a01e01","type":"pig","left":13,"top":9,"sway":40,"dir":-1},{"id":"a01e02","type":"pig","left":9.25,"top":2,"sway":24,"dir":1},{"id":"a01e03","type":"chameleon","left":4.25,"top":4,"sway":12,"dir":1},{"id":"a01e04","type":"chameleon","left":15.75,"top":3,"sway":18,"dir":1}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,13,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,3,0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,0,0,0,0],[9,16,0,0,0,0,0,0,13,14,14,15,0,0,4,5,6,0,0,1,2],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,[5,13],[5,14],15,0,12,9],[0,0,0,0,13,15,0,0,0,0,0,0,0,0,12,9,16,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[0,0,0,0,0,0,0,13,14,15,0,0,0,0,0,0,0,0,0,0,4],[0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,0,0,0,0,13,14],[2,2,2,2,3,0,0,0,0,0,0,0,4,5,6,0,0,0,0,0,0],[5,5,5,5,10,2,3,0,0,0,1,2,2,2,2,2,3,0,0,0,0],[5,5,5,5,5,5,6,0,0,0,4,5,5,5,5,5,6,0,0,0,0]],"collisonMap":[["","","","","","","","","","","","","","","","","","","","",""],["","","","","","t","t","","","","","","","","","","","","","",""],["t","tr","","","","","","","","","","","","","tl","t","t","","","",""],["","r","","","","","","","t","t","t","t","","","","","","","","t","t"],["","r","","","","","","","","","","","","","","t","t","t","","",""],["","","","","t","t","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","","t"],["","","","","","","","t","t","t","","","","","","","","","","",""],["","","","","","","","","","","","","tl","t","tr","","","","","t","t"],["t","t","t","t","tr","","","","","","","","","","","","","","","",""],["","","","","","lt","tr","","","","tl","t","t","t","t","t","t","","","",""],["","","","","","","r","lb","b","b","lb","","","","","","","","","",""]],"objectsMap":[[0,0,0,0,0,0,[{"id":9,"xOffset":0,"yOffset":10,"width":9,"height":6},{"id":8,"xOffset":-10,"yOffset":8,"width":11,"height":8}],0,0,0,0,0,0,0,0,0],[0,[{"id":6,"xOffset":-6,"yOffset":2,"width":14,"height":14}],0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":4,"xOffset":-8,"yOffset":7,"width":20,"height":10}],[{"id":11,"xOffset":-6,"yOffset":6,"width":12,"height":10}],0],[0,0,0,0,0,0,0,0,0,[{"id":1,"xOffset":-12,"yOffset":-16,"width":32,"height":32}],[{"id":1,"xOffset":-2,"yOffset":-8,"width":24,"height":24}],[{"id":2,"xOffset":-36,"yOffset":-24,"width":40,"height":40}],0,0,0,0,0,0,0,[{"id":5,"xOffset":6,"yOffset":2,"width":14,"height":14}],0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":1,"xOffset":10,"yOffset":-10,"width":26,"height":26}],[{"id":8,"xOffset":-4,"yOffset":10,"width":12,"height":6}],0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,[{"id":2,"xOffset":-8,"yOffset":-16,"width":32,"height":32},{"id":11,"xOffset":-8,"yOffset":8,"width":12,"height":8}],[{"id":7,"xOffset":-2,"yOffset":4,"width":12,"height":12}],0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":3,"xOffset":-4,"yOffset":6,"width":24,"height":10}],0,0,0,0,0,[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],[{"id":10,"xOffset":4,"yOffset":7,"width":12,"height":10}]],[[{"id":1,"xOffset":-6,"yOffset":-16,"width":32,"height":32},{"id":2,"xOffset":0,"yOffset":-40,"width":56,"height":56}],0,[{"id":4,"xOffset":0,"yOffset":8,"width":16,"height":8}],[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],[{"id":7,"xOffset":0,"yOffset":4,"width":12,"height":12},{"id":7,"xOffset":-6,"yOffset":-8,"width":12,"height":12}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,[{"id":11,"xOffset":0,"yOffset":4,"width":14,"height":12},{"id":10,"xOffset":10,"yOffset":8,"width":11,"height":8}],0,0,0,0,0,[{"id":7,"xOffset":5,"yOffset":4,"width":12,"height":12}],[{"id":4,"xOffset":11,"yOffset":10,"width":11,"height":6}],[{"id":2,"xOffset":8,"yOffset":-4,"width":20,"height":20}],[{"id":1,"xOffset":0,"yOffset":-16,"width":32,"height":32}],[{"id":8,"xOffset":0,"yOffset":8,"width":14,"height":8},{"id":9,"xOffset":-7,"yOffset":10,"width":11,"height":6}]],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-2.json":
/*!*******************************!*\
  !*** ./app/areas/area-2.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":2,"world":1,"rows":12,"columns":21,"theme":"grasslands","water":[{"left":3,"top":10},{"left":4,"top":10},{"left":5,"top":10},{"left":6,"top":10},{"left":3,"top":10.5},{"left":4,"top":10.5},{"left":5,"top":10.5},{"left":6,"top":10.5},{"left":3,"top":11},{"left":4,"top":11},{"left":5,"top":11},{"left":6,"top":11},{"left":13,"top":10},{"left":14,"top":10},{"left":15,"top":10},{"left":16,"top":10},{"left":13,"top":10.5},{"left":14,"top":10.5},{"left":15,"top":10.5},{"left":16,"top":10.5},{"left":13,"top":11},{"left":14,"top":11},{"left":15,"top":11},{"left":16,"top":11}],"coins":[{"id":"1c01","left":2.5,"top":0.5},{"id":"1c02","left":4.2,"top":0.7},{"id":"1c03","left":5.6,"top":1.5},{"id":"1c04","left":9.6,"top":1.5},{"id":"1c05","left":10.8,"top":0.5},{"id":"1c06","left":12.1,"top":0.5},{"id":"1c07","left":13.4,"top":1.5},{"id":"1c08","left":10.9,"top":3.8},{"id":"1c09","left":10.9,"top":5},{"id":"1c0801","left":12,"top":3.8},{"id":"1c0901","left":12,"top":5},{"id":"1c10","left":3.2,"top":4.5},{"id":"1c11","left":1.9,"top":5.1},{"id":"1c12","left":1,"top":6.3},{"id":"1c13","left":0.8,"top":7.8},{"id":"1c14","left":6.5,"top":2.8},{"id":"1c15","left":7,"top":7.3},{"id":"1c16","left":5.4,"top":7.5},{"id":"1c17","left":4.5,"top":8.8},{"id":"1c18","left":17,"top":7.3},{"id":"1c19","left":15.4,"top":7.5},{"id":"1c20","left":14.5,"top":8.8},{"id":"1c21","left":20,"top":5.7},{"id":"1c22","left":19,"top":4.4},{"id":"1c23","left":17.5,"top":3.7},{"id":"1c24","left":16.2,"top":3.5}],"death":[{"x":64,"y":170,"height":32,"width":32},{"x":224,"y":170,"height":32,"width":32}],"portals":[{"x":-8,"y":0,"height":32,"width":8,"direction":-1,"destinationArea":1,"destinationX":330,"destinationY":42},{"x":336,"y":0,"height":48,"width":8,"direction":1,"destinationArea":7,"destinationX":6,"destinationY":24}],"enemies":[{"id":"a02e01","type":"pig","left":8.25,"top":8,"sway":38,"dir":-1},{"id":"a02e02","type":"pig","left":18,"top":8,"sway":30,"dir":1},{"id":"a02e03","type":"chameleon","left":3.75,"top":5,"sway":16,"dir":1},{"id":"a02e04","type":"chameleon","left":15.75,"top":4,"sway":18,"dir":1},{"id":"a02e05","type":"chameleon","left":13.75,"top":2,"sway":18,"dir":-1}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,2,2,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2],[9,9,9,16,0,0,0,0,0,13,15,0,0,1,2,3,0,0,0,12,9],[0,0,0,0,0,0,13,15,0,0,0,0,0,4,5,6,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,4,5,[5,13],14,15,0,0,0],[0,0,0,13,14,15,0,0,0,0,0,0,0,12,9,16,0,0,0,0,0],[0,0,0,0,0,0,0,1,2,3,0,0,0,0,0,0,0,0,0,0,1],[0,0,0,0,0,0,0,4,5,6,0,0,0,0,0,0,0,0,0,0,4],[2,3,0,0,0,0,1,2,2,2,2,3,0,0,0,0,1,2,2,2,2],[2,2,2,3,0,0,4,5,5,5,5,10,2,3,0,0,4,5,5,5,5],[5,5,5,6,0,0,4,5,5,5,5,5,5,6,0,0,4,5,5,5,5]],"collisonMap":[["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","","",""],["t","t","t","tr","","","","","","","","","","","","","","","","t","t","t"],["","","","","","","","","","t","t","","","lt","t","t","","","","","",""],["","","","","","","t","t","","","","","","l","","","","","","","",""],["","","","","","","","","","","","","","","","t","t","t","","","",""],["","","","t","t","t","","","","","","","","","","","","","","","",""],["","","","","","","","t","t","t","","","","","","","","","","","t","t"],["","","","","","","","","","","","","","","","","","","","","",""],["t","t","","","","","tl","t","t","t","t","tr","","","","","tl","t","t","t","t","t"],["tb","tb","tb","tr","","","l","","","","","","t","tr","","r","l","","","","",""],["","","","rt","lb","rb","l","","","","","","","r","","r","l","","","","",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[[{"id":9,"xOffset":16,"yOffset":6,"width":16,"height":10},{"id":1,"xOffset":0,"yOffset":-16,"width":32,"height":32}],[{"id":8,"xOffset":-16,"yOffset":8,"width":16,"height":8},{"id":4,"xOffset":0,"yOffset":12,"width":12,"height":5}],[{"id":10,"xOffset":0,"yOffset":8,"width":8,"height":8},{"id":11,"xOffset":8,"yOffset":12,"width":6,"height":4}],[{"id":6,"xOffset":-5,"yOffset":2,"width":16,"height":16}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":5,"xOffset":2,"yOffset":2,"width":16,"height":16}]],[0,0,0,0,0,0,0,0,0,[{"id":8,"xOffset":4,"yOffset":9,"width":12,"height":7}],[{"id":9,"xOffset":0,"yOffset":10,"width":10,"height":6},{"id":10,"xOffset":-3,"yOffset":12,"width":4,"height":4}],0,0,[{"id":2,"xOffset":2,"yOffset":-24,"width":40,"height":40}],[{"id":11,"xOffset":-10,"yOffset":9,"width":10,"height":8},{"id":4,"xOffset":9,"yOffset":7,"width":18,"height":10}],0],[0,0,0,0,0,0,[{"id":1,"xOffset":0,"yOffset":-16,"width":32,"height":32},{"id":9,"xOffset":18,"yOffset":10,"width":10,"height":6},{"id":8,"xOffset":4,"yOffset":9,"width":14,"height":7}],0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":8,"xOffset":-6,"yOffset":6,"width":16,"height":10},{"id":9,"xOffset":6,"yOffset":9,"width":12,"height":7}],0,0],[0,0,0,0,[{"id":7,"xOffset":-4,"yOffset":5,"width":12,"height":12}],[{"id":7,"xOffset":-8,"yOffset":5,"width":12,"height":12},{"id":7,"xOffset":-14,"yOffset":-7,"width":12,"height":12}],0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,[{"id":3,"xOffset":-6,"yOffset":4,"width":22,"height":12}],0,0,0,0,0,0,0,0,0,0,0,[{"id":10,"xOffset":6,"yOffset":6,"width":12,"height":10}],0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,[{"id":4,"xOffset":8,"yOffset":10,"width":12,"height":6}],0,0,[{"id":2,"xOffset":5,"yOffset":-24,"width":40,"height":40}],[{"id":1,"xOffset":-20,"yOffset":-14,"width":30,"height":30},{"id":9,"xOffset":-6,"yOffset":8,"width":16,"height":8}],0,0,0,0,0,0,[{"id":2,"xOffset":-9,"yOffset":-20,"width":36,"height":36},{"id":1,"xOffset":0,"yOffset":-32,"width":48,"height":48},{"id":9,"xOffset":-6,"yOffset":8,"width":16,"height":8}],0,[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],0],[0,0,[{"id":1,"xOffset":14,"yOffset":-6,"width":22,"height":22},{"id":1,"xOffset":-8,"yOffset":-12,"width":28,"height":28},{"id":2,"xOffset":0,"yOffset":-15,"width":32,"height":32}],0,0,0,0,0,0,0,0,0,[{"id":7,"xOffset":2,"yOffset":4,"width":12,"height":12},{"id":1,"xOffset":2,"yOffset":-16,"width":32,"height":32}],[{"id":9,"xOffset":-9,"yOffset":10,"width":12,"height":7},{"id":8,"xOffset":4,"yOffset":9,"width":10,"height":7}],0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-3.json":
/*!*******************************!*\
  !*** ./app/areas/area-3.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":3,"world":2,"rows":12,"columns":21,"theme":"iceland","water":[{"left":6,"top":10},{"left":6,"top":10.5},{"left":6,"top":11},{"left":7,"top":10},{"left":7,"top":10.5},{"left":7,"top":11},{"left":8,"top":10},{"left":8,"top":10.5},{"left":8,"top":11},{"left":9,"top":10},{"left":9,"top":10.5},{"left":9,"top":11},{"left":10,"top":10},{"left":10,"top":10.5},{"left":10,"top":11},{"left":16,"top":10},{"left":16,"top":10.5},{"left":16,"top":11},{"left":17,"top":10},{"left":17,"top":10.5},{"left":17,"top":11},{"left":18,"top":10},{"left":18,"top":10.5},{"left":18,"top":11},{"left":19,"top":10},{"left":19,"top":10.5},{"left":19,"top":11},{"left":20,"top":10},{"left":20,"top":10.5},{"left":20,"top":11}],"coins":[{"id":"2c01","left":3.5,"top":3.9},{"id":"2c02","left":2.2,"top":4.7},{"id":"2c03","left":1.5,"top":6.1},{"id":"2c04","left":1.2,"top":7.5},{"id":"2c05","left":6.2,"top":8.8},{"id":"2c06","left":7.3,"top":7.8},{"id":"2c07","left":8.7,"top":7.8},{"id":"2c08","left":9.8,"top":8.8},{"id":"2c09","left":5.7,"top":3.9},{"id":"2c10","left":7.1,"top":4.3},{"id":"2c11","left":8,"top":5.5},{"id":"2c12","left":7.7,"top":1.7},{"id":"2c13","left":9.55,"top":1.5},{"id":"2c14","left":11.4,"top":1.7},{"id":"2c15","left":16.3,"top":8.7},{"id":"2c16","left":17.2,"top":7.1},{"id":"2c17","left":19,"top":6.7},{"id":"2c18","left":20,"top":4.7},{"id":"2c19","left":18.9,"top":3.1},{"id":"2c20","left":17.3,"top":2.7},{"id":"2c21","left":14.8,"top":2.7},{"id":"2c22","left":13.2,"top":3.4},{"id":"2c23","left":12.5,"top":4.8},{"id":"2c24","left":5.5,"top":0},{"id":"2c25","left":3.7,"top":0.15},{"id":"2c26","left":2.5,"top":1}],"death":[{"x":112,"y":170,"height":32,"width":48},{"x":272,"y":170,"height":32,"width":64}],"portals":[{"x":-8,"y":0,"height":32,"width":8,"direction":-1,"destinationArea":7,"destinationX":330,"destinationY":96},{"x":336,"y":0,"height":48,"width":8,"direction":1,"destinationArea":8,"destinationX":16,"destinationY":56}],"enemies":[{"id":"a03e01","type":"pig","left":13,"top":9,"sway":40,"dir":-1},{"id":"a03e02","type":"pig","left":9.25,"top":2,"sway":24,"dir":1},{"id":"a03e03","type":"chameleon","left":7.75,"top":6,"sway":16,"dir":1},{"id":"a03e04","type":"chameleon","left":14.75,"top":1,"sway":18,"dir":-1},{"id":"a03e05","type":"chameleon","left":19.75,"top":7,"sway":12,"dir":-1}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,13,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,3,0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,0,0,0,0],[9,16,0,0,0,0,0,0,13,14,14,15,0,0,4,5,6,0,0,1,2],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,[5,13],[5,14],15,0,12,9],[0,0,0,0,13,15,0,0,0,0,0,0,0,0,12,9,16,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[0,0,0,0,0,0,0,13,14,15,0,0,0,0,0,0,0,0,0,0,4],[0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,0,0,0,0,13,14],[2,2,2,2,3,0,0,0,0,0,0,0,4,5,6,0,0,0,0,0,0],[5,5,5,5,10,2,3,0,0,0,1,2,2,2,2,2,3,0,0,0,0],[5,5,5,5,5,5,6,0,0,0,4,5,5,5,5,5,6,0,0,0,0]],"collisonMap":[["","","","","","","","","","","","","","","","","","","","",""],["","","","","","t","t","","","","","","","","","","","","","",""],["t","tr","","","","","","","","","","","","","tl","t","t","","","",""],["","r","","","","","","","t","t","t","t","","","","","","","","t","t"],["","r","","","","","","","","","","","","","","t","t","t","","",""],["","","","","t","t","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","","t"],["","","","","","","","t","t","t","","","","","","","","","","",""],["","","","","","","","","","","","","tl","t","tr","","","","","t","t"],["t","t","t","t","tr","","","","","","","","","","","","","","","",""],["","","","","","lt","tr","","","","tl","t","t","t","t","t","t","","","",""],["","","","","","","r","lb","b","b","lb","","","","","","","","","",""]],"objectsMap":[[0,0,0,0,0,0,[{"id":9,"xOffset":0,"yOffset":7,"width":9,"height":9},{"id":8,"xOffset":-10,"yOffset":6,"width":11,"height":10}],0,0,0,0,0,0,0,0,0],[0,[{"id":6,"xOffset":-6,"yOffset":2,"width":14,"height":14}],0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":4,"xOffset":-8,"yOffset":7,"width":20,"height":10}],0,0],[0,0,0,0,0,0,0,0,0,[{"id":1,"xOffset":-12,"yOffset":-16,"width":32,"height":32}],[{"id":1,"xOffset":-2,"yOffset":-8,"width":24,"height":24}],[{"id":2,"xOffset":-36,"yOffset":-24,"width":40,"height":40}],0,0,0,0,0,0,0,[{"id":5,"xOffset":6,"yOffset":2,"width":14,"height":14}],0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":1,"xOffset":10,"yOffset":-10,"width":26,"height":26}],[{"id":8,"xOffset":-4,"yOffset":6,"width":12,"height":10}],0,0,0],[0,0,0,0,[{"id":9,"xOffset":5,"yOffset":5,"width":11,"height":11}],[{"id":9,"xOffset":0,"yOffset":5,"width":11,"height":11},{"id":9,"xOffset":-5,"yOffset":-5,"width":11,"height":11}],0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,[{"id":2,"xOffset":-8,"yOffset":-16,"width":32,"height":32}],[{"id":7,"xOffset":-2,"yOffset":4,"width":12,"height":12}],0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":3,"xOffset":-4,"yOffset":-11,"width":24,"height":27}],0,0,0,0,0,[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],[{"id":10,"xOffset":4,"yOffset":7,"width":12,"height":10}]],[[{"id":1,"xOffset":-6,"yOffset":-16,"width":32,"height":32},{"id":2,"xOffset":0,"yOffset":-40,"width":56,"height":56}],0,[{"id":4,"xOffset":0,"yOffset":8,"width":16,"height":8}],[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],[{"id":7,"xOffset":0,"yOffset":4,"width":12,"height":12},{"id":7,"xOffset":-6,"yOffset":-8,"width":12,"height":12}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,[{"id":10,"xOffset":10,"yOffset":8,"width":11,"height":8}],0,0,0,0,0,[{"id":7,"xOffset":5,"yOffset":4,"width":12,"height":12}],[{"id":4,"xOffset":11,"yOffset":10,"width":11,"height":6}],[{"id":2,"xOffset":8,"yOffset":-4,"width":20,"height":20}],[{"id":1,"xOffset":0,"yOffset":-16,"width":32,"height":32}],[{"id":8,"xOffset":0,"yOffset":4,"width":14,"height":12},{"id":9,"xOffset":-7,"yOffset":5,"width":11,"height":11}]],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-4.json":
/*!*******************************!*\
  !*** ./app/areas/area-4.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":4,"world":3,"theme":"desert","death":[{"x":64,"y":170,"height":32,"width":32},{"x":192,"y":170,"height":32,"width":32}],"coins":[{"id":"4c1","left":1.5,"top":2},{"id":"4c2","left":11,"top":2},{"id":"4c3","left":15,"top":2},{"id":"4c4","left":5,"top":1},{"id":"4c5","left":8,"top":4},{"id":"4c6","left":10,"top":6},{"id":"4c7","left":12,"top":6},{"id":"4c8","left":14,"top":8},{"id":"4c9","left":7,"top":9},{"id":"4c10","left":1,"top":8}],"portals":[{"x":-8,"y":0,"height":48,"width":8,"direction":-1,"destinationArea":3,"destinationX":250,"destinationY":42},{"x":256,"y":0,"height":48,"width":8,"direction":1,"destinationArea":5,"destinationX":16,"destinationY":42}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,13,14,15,0,0,0,0,0,0,0,0],[2,2,3,0,0,0,0,0,0,0,13,15,0,0,1,2],[5,5,10,2,3,0,0,0,0,0,0,0,0,0,4,5],[9,9,9,9,16,0,0,13,15,0,0,0,0,0,12,9],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,13,14,14,15,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,2,2,3,0,0,0,0,1,2,2,3,0,0,1,2],[5,5,5,6,0,0,1,2,8,5,5,6,0,0,4,5],[5,5,5,6,0,0,4,5,5,5,5,6,0,0,4,5]],"collisonMap":[["","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","",""],["","","","","","t","t","t","","","","","","","",""],["t","t","tr","","","","","","","","t","t","","","tl","t"],["","","r","tl","tr","","","","","","","","","","l",""],["","","","","","","","t","t","","","","","","",""],["","","","","r","","","","","","","","","","",""],["","","","","","","","","","","t","t","t","t","",""],["","","","","","","","","","","","","","","",""],["t","t","t","tr","","","","","tl","t","t","tr","","","tl","t"],["","","","r","","","tl","tr","l","","","r","","","l",""],["","","","rb","bl","br","l","","","","","r","bl","br","lb",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,[{"id":15,"xOffset":0,"yOffset":0,"width":16,"height":16}],[{"id":15,"xOffset":0,"yOffset":0,"width":16,"height":16}],0,0,0,0,0,0,[{"id":15,"xOffset":0,"yOffset":0,"width":16,"height":16}],[{"id":15,"xOffset":0,"yOffset":0,"width":16,"height":16}],0,0]]}');

/***/ }),

/***/ "./app/areas/area-5.json":
/*!*******************************!*\
  !*** ./app/areas/area-5.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":5,"world":4,"rows":12,"columns":16,"theme":"dungeon","death":[{"x":48,"y":170,"height":32,"width":32},{"x":176,"y":170,"height":32,"width":32},{"x":240,"y":170,"height":32,"width":16}],"portals":[{"x":-8,"y":0,"height":48,"width":8,"direction":-1,"destinationArea":4,"destinationX":250,"destinationY":42},{"x":256,"y":0,"height":48,"width":9,"direction":1,"destinationArea":6,"destinationX":6,"destinationY":42}],"areaMap":[[9,9,9,9,16,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,13,14,14,15,0,0,0,0,0],[2,2,2,3,0,0,0,0,0,0,0,0,0,0,1,2],[9,9,9,16,0,0,0,0,0,0,0,0,0,0,12,9],[0,0,0,0,0,0,13,14,15,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,13,15,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,2,3,0,0,0,0,0,1,2,3,0,0,0,0,0],[5,5,6,0,0,0,0,0,4,5,6,0,0,0,0,0],[5,5,6,0,0,1,2,2,8,5,6,0,0,1,3,0],[5,5,6,0,0,4,5,5,5,5,6,0,0,4,6,0]],"collisonMap":[["","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","",""],["","","","","","","","t","t","t","t","","","","",""],["t","t","t","t","","","","","","","","","","","t","t"],["","","","","","","","","","","","","","","",""],["","","","","","","t","t","t","","","","","","",""],["","","","","","","","","","","","t","t","","",""],["","","","","","","","","","","","","","","",""],["t","t","tr","","","","","","t","t","tr","","","","",""],["","","r","","","","","","l","","r","","","","",""],["","","r","","","lt","t","tr","","r","r","","","tl","tr",""],["","","r","l","r","l","","","","","r","bl","br","l","r",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-6.json":
/*!*******************************!*\
  !*** ./app/areas/area-6.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":6,"world":5,"theme":"lab","death":[{"x":64,"y":170,"height":32,"width":32},{"x":176,"y":160,"height":20,"width":32}],"portals":[{"x":-8,"y":0,"height":48,"width":8,"direction":-1,"destinationArea":5,"destinationX":250,"destinationY":42},{"x":256,"y":0,"height":48,"width":9,"direction":1,"destinationArea":1,"destinationX":6,"destinationY":24}],"areaMap":[[18,19,18,19,18,19,18,19,18,19,18,19,18,19,18,19],[20,21,20,21,20,21,20,21,20,21,20,21,20,21,20,21],[21,20,21,20,21,12,13,14,21,20,21,20,21,20,21,20],[2,2,3,21,20,21,20,21,20,21,20,21,20,21,1,2],[9,9,11,20,21,20,21,20,21,20,15,20,21,20,9,10],[20,21,20,21,20,21,12,13,14,21,20,21,20,21,20,21],[21,20,21,20,21,20,21,20,21,20,21,12,14,20,21,20],[20,21,20,21,20,21,20,21,20,21,20,21,20,21,20,1],[21,20,21,20,21,20,21,20,21,20,21,20,21,20,21,20],[20,21,20,21,20,21,20,21,20,1,2,21,20,3,20,21],[2,2,2,3,16,16,1,2,2,7,5,20,21,8,2,2],[5,5,5,6,17,17,4,5,5,5,5,5,5,5,5,5]],"collisonMap":[["","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","",""],["","","","","","t","t","t","","","","","","","",""],["t","t","tr","","","","","","","","","","","","tl","t"],["","","","","","","","","","","t","","","","",""],["","","","","","","t","t","t","","","","","","",""],["","","","","","","","","","","","t","t","","",""],["","","","","","","","","","","","","","","","t"],["","","","","","","","","","","","","","","",""],["","","","","","","","","","tl","tr","","","tr","",""],["t","t","t","tr","","","tl","t","tr","","r","","","l","tl","t"],["","","","r","lb","rb","l","","","","","t","t","","",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-7.json":
/*!*******************************!*\
  !*** ./app/areas/area-7.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":7,"world":1,"theme":"grasslands","rows":12,"columns":21,"water":[{"left":0,"top":11},{"left":1,"top":11},{"left":2,"top":11},{"left":3,"top":11},{"left":4,"top":11},{"left":7,"top":11},{"left":8,"top":11},{"left":9,"top":11},{"left":10,"top":11},{"left":14,"top":11},{"left":15,"top":11},{"left":16,"top":11},{"left":17,"top":11},{"left":18,"top":11},{"left":19,"top":11},{"left":20,"top":11}],"coins":[{"id":"7c00","left":14,"top":0.5},{"id":"7c01","left":17,"top":0.5},{"id":"7c02","left":18.5,"top":1.5},{"id":"7c03","left":19.1,"top":2.8},{"id":"7c04","left":19.5,"top":4.25},{"id":"7c05","left":19.5,"top":5.5},{"id":"7c06","left":12.5,"top":1.5},{"id":"7c07","left":11.9,"top":2.8},{"id":"7c08","left":8.5,"top":2.8},{"id":"7c09","left":7.4,"top":3.7},{"id":"7c10","left":6.5,"top":4.7},{"id":"7c11","left":6.1,"top":6},{"id":"7c12","left":6,"top":7.5},{"id":"7c13","left":13.8,"top":5.5},{"id":"7c14","left":12.4,"top":6.1},{"id":"7c15","left":11.5,"top":7.5},{"id":"7c16","left":2,"top":0.5},{"id":"7c17","left":3.4,"top":0.9},{"id":"7c18","left":4.5,"top":1.8},{"id":"7c19","left":2.6,"top":4.5},{"id":"7c20","left":1.7,"top":5.7},{"id":"7c21","left":0.3,"top":6.1}],"death":[{"x":0,"y":176,"height":16,"width":336}],"portals":[{"x":-8,"y":0,"height":32,"width":8,"direction":-1,"destinationArea":2,"destinationX":330,"destinationY":24},{"x":336,"y":64,"height":48,"width":8,"direction":1,"destinationArea":3,"destinationX":6,"destinationY":24}],"enemies":[{"id":"a07e01","type":"pig","left":5.3,"top":8,"sway":22,"dir":-1},{"id":"a07e02","type":"pig","left":12.4,"top":8,"sway":24,"dir":1},{"id":"a07e02","type":"pig","left":16.9,"top":6,"sway":44,"dir":-1},{"id":"a07e03","type":"chameleon","left":4.75,"top":2,"sway":16,"dir":1},{"id":"a07e04","type":"chameleon","left":9.75,"top":4,"sway":16,"dir":1},{"id":"a07e05","type":"chameleon","left":15.15,"top":1,"sway":24,"dir":-1}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,13,15,0,0,0,0,0,0,0,0,0,0],[2,3,0,0,0,0,0,0,0,0,0,0,0,0,13,14,14,15,0,0,0],[5,6,0,0,13,14,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[9,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,13,14,15,0,0,0,1,3,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,6,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2],[3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,5,5,5,5,5,5],[6,0,0,0,1,2,2,3,0,0,0,1,2,2,[9,3],9,9,9,9,9,9],[16,0,13,14,[5,14],[5,15],5,6,0,0,0,4,5,5,6,0,0,0,0],[0,0,0,0,4,5,5,6,0,0,0,4,5,5,6,0,0,0,0,0,0]],"collisonMap":[["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","","","t","t","","","","","","","","","",""],["t","t","","","","","","","","","","","","","t","t","t","t","","",""],["","","","","t","t","t","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","","","t","t","t","","","","t","t","","","",""],["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","t","t","t","t","t","t","t"],["t","","","","","","","","","","","","","","","","","","","",""],["","","","","t","t","t","t","","","","t","t","t","t","","","","","",""],["","","t","t","t","t","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,[{"id":9,"xOffset":10,"yOffset":8,"width":18,"height":8},{"id":8,"xOffset":6,"yOffset":11,"width":12,"height":6}],0,0,0,0,0,0,0,0,0,0,0],[0,[{"id":6,"xOffset":-4,"yOffset":1,"width":16,"height":16}],0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12},{"id":7,"xOffset":10,"yOffset":-8,"width":12,"height":12}],[{"id":7,"xOffset":0,"yOffset":4,"width":12,"height":12}],0,0,0,0,0],[0,0,0,0,[{"id":2,"xOffset":14,"yOffset":-16,"width":32,"height":32},{"id":1,"xOffset":-4,"yOffset":-23,"width":40,"height":40}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,[{"id":2,"xOffset":8,"yOffset":-15,"width":32,"height":32},{"id":11,"xOffset":8,"yOffset":8,"width":10,"height":8}],0,[{"id":10,"xOffset":-2,"yOffset":7,"width":12,"height":10}],0,0,0,0,[{"id":3,"xOffset":-8,"yOffset":8,"width":18,"height":8}],0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":5,"xOffset":2,"yOffset":1,"width":16,"height":16}],[{"id":2,"xOffset":20,"yOffset":-16,"width":32,"height":32},{"id":1,"xOffset":-16,"yOffset":-24,"width":40,"height":40},{"id":1,"xOffset":-8,"yOffset":-39,"width":56,"height":56}],0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,[{"id":1,"xOffset":12,"yOffset":-16,"width":32,"height":32},{"id":2,"xOffset":-8,"yOffset":-32,"width":48,"height":48}],[{"id":9,"xOffset":0,"yOffset":10,"width":12,"height":7}],[{"id":4,"xOffset":3,"yOffset":4,"width":20,"height":12},{"id":4,"xOffset":18,"yOffset":11,"width":12,"height":6}],0,0,0,0,[{"id":1,"xOffset":0,"yOffset":-19,"width":36,"height":36}],0,[{"id":7,"xOffset":4,"yOffset":4,"width":12,"height":12}],0,0],[0,0,[{"id":1,"xOffset":0,"yOffset":-16,"width":32,"height":32},{"id":8,"xOffset":6,"yOffset":10,"width":10,"height":7}],[{"id":11,"xOffset":4,"yOffset":8,"width":10,"height":8}],0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ }),

/***/ "./app/areas/area-8.json":
/*!*******************************!*\
  !*** ./app/areas/area-8.json ***!
  \*******************************/
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"id":8,"world":2,"rows":12,"columns":21,"theme":"iceland","water":[{"left":8,"top":10.5},{"left":8,"top":11},{"left":9,"top":10.5},{"left":9,"top":11},{"left":10,"top":10.5},{"left":10,"top":11},{"left":11,"top":10.5},{"left":11,"top":11},{"left":12,"top":10.5},{"left":12,"top":11}],"coins":[{"id":"8c01","left":3.5,"top":2.6},{"id":"8c02","left":4.2,"top":1.3},{"id":"8c03","left":5.8,"top":0.6},{"id":"8c04","left":7.5,"top":0.5},{"id":"8c05","left":17.5,"top":2.6},{"id":"8c06","left":16.8,"top":1.3},{"id":"8c07","left":15.2,"top":0.6},{"id":"8c08","left":13.5,"top":0.5},{"id":"8c09","left":6.5,"top":3.6},{"id":"8c10","left":12.5,"top":8.6},{"id":"8c11","left":7.5,"top":8.6},{"id":"8c12","left":8.3,"top":6.8},{"id":"8c13","left":10.4,"top":5.4},{"id":"8c14","left":12.5,"top":4.8},{"id":"8c15","left":14.5,"top":4.6},{"id":"8c16","left":8.8,"top":4},{"id":"8c17","left":11.7,"top":6.9}],"death":[{"x":144,"y":170,"height":32,"width":48}],"portals":[{"x":-8,"y":0,"height":64,"width":8,"direction":-1,"destinationArea":3,"destinationX":330,"destinationY":42},{"x":336,"y":0,"height":64,"width":8,"direction":1,"destinationArea":1,"destinationX":16,"destinationY":24}],"enemies":[{"id":"a08e01","type":"pig","left":10.25,"top":1,"sway":52,"dir":-1},{"id":"a08e02","type":"pig","left":10.25,"top":1,"sway":52,"dir":1},{"id":"a08e03","type":"pig","left":17.75,"top":7,"sway":28,"dir":1},{"id":"a08e04","type":"pig","left":1.75,"top":7,"sway":28,"dir":-1},{"id":"a08e05","type":"chameleon","left":6.25,"top":9,"sway":22,"dir":1},{"id":"a08e06","type":"chameleon","left":18.25,"top":3,"sway":22,"dir":-1}],"areaMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,13,14,14,14,14,14,14,15,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[2,2,2,2,3,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2],[5,5,5,5,10,2,2,3,0,0,0,0,0,0,0,0,0,4,5,5,5],[5,5,5,5,5,5,5,6,0,0,0,0,0,0,1,2,2,8,5,5,5],[5,5,5,5,5,5,5,6,0,0,0,0,0,0,4,5,5,5,5,5,5],[2,2,2,2,[5,3],5,5,6,0,0,0,0,0,0,4,5,[5,1],2,2,2,2],[5,5,5,5,[5,6],5,5,6,0,0,0,0,0,0,4,5,[5,4],5,5,5,5],[5,5,5,5,10,2,2,2,3,0,0,0,1,2,2,2,8,5,5,5,5],[5,5,5,5,5,5,5,5,6,0,0,0,4,5,5,5,5,5,5,5,5]],"collisonMap":[["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","","","","","","","","","","","","","",""],["","","","","","","","t","t","t","t","t","t","t","t","","","","","",""],["","","","","","","","","","","","","","","","","","","","",""],["t","t","t","t","tr","","","","","","","","","","","","","tl","t","t","t"],["","","","","r","t","t","t","","","","","","","","","","l","","",""],["","","","","","","","","","","","","","","t","t","t","l","","",""],["","","","","","","","","","","","","","","","","","","","",""],["t","t","t","t","t","","","","","","","","","","","","tl","t","t","t","t"],["","","","","r","","","","","","","","","","","","l","","","",""],["","","","","r","t","t","t","tr","","","","tl","t","t","t","","","","",""],["","","","","","","","","r","","","","l","","","","","","","",""]],"objectsMap":[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,[{"id":10,"xOffset":0,"yOffset":-4,"width":60,"height":20}],0,0,0,0,0,0,0,0,0,0,0],[0,[{"id":2,"xOffset":-12,"yOffset":-16,"width":48,"height":48}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,[{"id":6,"xOffset":0,"yOffset":0,"width":16,"height":16}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":5,"xOffset":0,"yOffset":0,"width":16,"height":16}],0],[0,0,0,0,0,[{"id":8,"xOffset":0,"yOffset":0,"width":18,"height":16}],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,[{"id":1,"xOffset":-4,"yOffset":-16,"width":32,"height":48}],0,[{"id":7,"xOffset":9,"yOffset":8,"width":12,"height":12}],0,0,0,0,0,0,0,0,0,0,0,[{"id":3,"xOffset":0,"yOffset":-32,"width":24,"height":32}],0,0,0,[{"id":1,"xOffset":4,"yOffset":-16,"width":32,"height":48}],0],[0,0,0,[{"id":7,"xOffset":2,"yOffset":4,"width":12,"height":12}],[{"id":7,"xOffset":0,"yOffset":4,"width":12,"height":12}],0,0,0,0,0,0,0,0,0,0,0,0,0,[{"id":8,"xOffset":4,"yOffset":0,"width":18,"height":16}],0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,[{"id":10,"xOffset":8,"yOffset":0,"width":48,"height":16}],0,0,0,0,0,0,[{"id":4,"xOffset":8,"yOffset":4,"width":21,"height":12}],0,[{"id":9,"xOffset":8,"yOffset":4,"width":12,"height":12},{"id":9,"xOffset":8,"yOffset":-8,"width":12,"height":12}],0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./app/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _game__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./game */ "./app/game/index.js");
/* harmony import */ var _screen__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./screen */ "./app/screen/index.js");
/* harmony import */ var _engine__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./engine */ "./app/engine/index.js");
/* harmony import */ var _controller__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./controller */ "./app/controller/index.js");
/* harmony import */ var _controller_mouse_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./controller/mouse-input */ "./app/controller/mouse-input.js");
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./util */ "./app/util/index.js");
/* harmony import */ var _areas__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./areas */ "./app/areas/index.js");






(0,_util__WEBPACK_IMPORTED_MODULE_5__.preLoadAndFetch)();
(0,_util__WEBPACK_IMPORTED_MODULE_5__.populateLinks)();
(0,_util__WEBPACK_IMPORTED_MODULE_5__.populateHelp)();

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
    (controller) => controller.style.visibility = isTouchesEnabled && value ? "visible" : "hidden"
  );
  persistentControllers.forEach(
    (controller) => controller.style.visibility = value ? "visible" : "hidden"
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
window.addEventListener("load", function() {
  "use strict";
  let areaId = 1;
  let loaded = false;
  let paused = false;
  let areaNumber = 1;
  let worldChanged = false;
  const totalAreaNumber = 5;
  toggleSoundBtn((0,_util__WEBPACK_IMPORTED_MODULE_5__.getData)("mute_sounds"));
  toggleMusicBtn((0,_util__WEBPACK_IMPORTED_MODULE_5__.getData)("mute_music"));
  clearInterval(loadInterval);
  toggleLoadingScreen(false);
  setProgressValue(0);
  const controller = new _controller__WEBPACK_IMPORTED_MODULE_3__["default"]();
  const game = new _game__WEBPACK_IMPORTED_MODULE_0__["default"]((score) => {
    startTitle.textContent = "Game Over";
    scoreTitle.textContent = "Score: " + score;
    const savedScore = (0,_util__WEBPACK_IMPORTED_MODULE_5__.getData)("high_score") || 0;
    const highScore = savedScore < score ? score : savedScore;
    (0,_util__WEBPACK_IMPORTED_MODULE_5__.setData)("high_score", savedScore < score ? score : savedScore);
    if (highScore) {
      document.getElementById("highScore").innerHTML = `High Score: ${highScore}`;
    }
    setTimeout(() => {
      toggleStartScreen(true);
    }, 1500);
  });
  const setupWorld = () => {
    game.world.setup(_areas__WEBPACK_IMPORTED_MODULE_6__["default"][areaId]);
  };
  let screen;
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
    screen = new _screen__WEBPACK_IMPORTED_MODULE_1__["default"](document.querySelector("canvas"), _areas__WEBPACK_IMPORTED_MODULE_6__["default"][areaId].world);
    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
    resize();
  };
  setupScreen();
  const loadPercent = () => {
    const totalAssets = (worldChanged ? 0 : game.world.assetCount) + screen.assetCount;
    const totalLoaded = (worldChanged ? 0 : game.world.loadCount) + screen.loadCount;
    return Math.round(totalLoaded / totalAssets * 100);
  };
  const isLoaded = () => {
    return game.isLoaded() && screen.isLoaded();
  };
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
        }
        player.jump();
        controller.up.active = false;
      }
      if (controller.fire.active && !player.firing) {
        const { fireballs } = game.world;
        const offsetX = player.direction < 0 ? -32 : 8;
        player.fire();
        game.world.playFireSound();
        fireballs.add((0,_util__WEBPACK_IMPORTED_MODULE_5__.uid)(), player.x + offsetX, player.y - 16, player.direction);
        controller.fire.active = false;
      }
    }
    if (portal) {
      worldChanged = true;
      engine.hold();
      const { direction, destinationArea } = portal;
      if (destinationArea !== areaId) {
        if (direction < 0) {
          areaNumber--;
        } else {
          areaNumber++;
        }
        if (areaNumber >= totalAreaNumber) {
          areaNumber = 1;
        }
        if (areaNumber <= 0) {
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
      totalEnemies
    } = game.world;
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
          waterItem.offsetY
        );
      }
    }
    screen.drawMap(map);
    screen.drawMapObjects(objects);
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
          coin.offsetY
        );
      }
    }
    if (fireballs) {
      for (let index = 0; index < fireballs.items.length; index++) {
        const fireball = fireballs.items[index];
        screen.drawObject(
          fireball.animator.frameValue,
          fireball.x,
          fireball.y,
          fireball.width,
          fireball.height
        );
      }
    }
    if (enemies) {
      for (let index = 0; index < enemies.items.length; index++) {
        const enemy = enemies.items[index];
        screen.drawObject(
          enemy.animator.frameValue,
          enemy.x,
          enemy.y,
          enemy.width,
          enemy.height,
          0,
          1
        );
      }
    }
    const dead = game.world.isPlayerDead;
    const deadOffset = dead ? player.direction < 0 ? 12 : -12 : 0;
    const xOffset = player.direction < 0 ? -36 + deadOffset : -12 + deadOffset;
    screen.drawPlayer(
      player.animator.frameValue,
      player.getLeft(),
      player.getTop(),
      60,
      40,
      xOffset,
      -24
    );
    const image = new Image();
    image.src = "./assets/sprites/coin/image 1.webp";
    const coinTextOffest = totalCoins >= 10 && totalCoins <= 99 ? 3 : totalCoins > 99 ? 3.4 : 2.7;
    screen.drawObject(image, (columns - 1.3) * 16, 8, 10, 10);
    screen.drawText("x", (columns - 2) * 16, 15);
    screen.drawText(totalCoins, (columns - coinTextOffest) * 16, 16.1);
    screen.drawText(areaNumber, 48, 15.3);
    screen.drawText("Area", 12, 15.3);
    screen.drawText("x", 38, 15);
    const score = totalEnemies * 100 + totalCoins * 20;
    const scoreTextOffest = score >= score >= 10 && score <= 99 ? 3 : score > 99 ? 3.4 : 2.7;
    screen.drawText(score, (columns - scoreTextOffest) * 9, 15.3);
    screen.render();
  };
  resize();
  var engine = new _engine__WEBPACK_IMPORTED_MODULE_2__["default"](1e3 / 30, update, render);
  const keyDownUp = ({ type, keyCode }) => {
    controller.keyDownUp(type, keyCode);
  };
  window.addEventListener("keydown", keyDownUp);
  window.addEventListener("keyup", keyDownUp);
  window.addEventListener("resize", resize);
  const leftMouse = new _controller_mouse_input__WEBPACK_IMPORTED_MODULE_4__["default"]("leftBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 37);
  });
  const rightMouse = new _controller_mouse_input__WEBPACK_IMPORTED_MODULE_4__["default"]("rightBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 39);
  });
  const upMouse = new _controller_mouse_input__WEBPACK_IMPORTED_MODULE_4__["default"]("jumpBtn", (e) => {
    clearMouse();
    controller.keyDownUp(e, 32);
  });
  const fireMouse = new _controller_mouse_input__WEBPACK_IMPORTED_MODULE_4__["default"]("fireBtn", (e) => {
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
  (0,_util__WEBPACK_IMPORTED_MODULE_5__.populatePortals)(onPortalClick);
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
    areaNumber = 1;
    startBtn.click();
  };
  soundBtn.onclick = () => {
    const isMuted = !(0,_util__WEBPACK_IMPORTED_MODULE_5__.getData)("mute_sounds");
    (0,_util__WEBPACK_IMPORTED_MODULE_5__.setData)("mute_sounds", isMuted);
    toggleSoundBtn(isMuted);
  };
  musicBtn.onclick = () => {
    const isMuted = !(0,_util__WEBPACK_IMPORTED_MODULE_5__.getData)("mute_music");
    (0,_util__WEBPACK_IMPORTED_MODULE_5__.setData)("mute_music", isMuted);
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
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") {
      if (!paused) {
        game.world.playThemeMusic();
      }
    } else {
      game.world.pauseThemeMusic();
    }
  });
});

})();

/******/ })()
;
//# sourceMappingURL=bundle.js.map