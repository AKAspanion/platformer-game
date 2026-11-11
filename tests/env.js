// Browser globals the game touches, stubbed for node. Import this first.

class FakeImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = "";
  }

  set src(value) {
    this._src = value;
    if (value) globalThis.__requested.push(value);
    queueMicrotask(() => this.onload && this.onload());
  }

  get src() {
    return this._src;
  }
}

class FakeAudio {
  constructor(src = "") {
    this.volume = 1;
    this.loop = false;
    this.currentTime = 0;
    this.listeners = {};
    this.src = src;
  }

  // like a real element, setting src starts the download
  set src(value) {
    this._src = value;
    if (value) {
      globalThis.__requested.push(value);
      globalThis.__audios[value] = this;
    }
  }

  get src() {
    return this._src;
  }

  play() {
    // tests can check what was heard
    globalThis.__played.push(this.src.replace(/^.*\/audio\//, ""));
    return Promise.resolve();
  }

  // a copy shares the already-downloaded data: it asks for nothing
  cloneNode() {
    const copy = new FakeAudio();
    copy._src = this._src;
    return copy;
  }

  pause() {}

  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }

  /** Tests finish (or fail) the download by hand: audio.fire("canplaythrough"). */
  fire(type) {
    const handlers = this.listeners[type] || [];
    this.listeners[type] = [];
    handlers.forEach((handler) => handler());
  }
}

const store = new Map();
globalThis.__played = [];
// every Image/Audio src the game asked for, and the audio element for each url
globalThis.__requested = [];
globalThis.__audios = {};

globalThis.Image = FakeImage;
globalThis.Audio = FakeAudio;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
