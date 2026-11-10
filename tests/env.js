// Browser globals the game touches, stubbed for node. Import this first.

class FakeImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = "";
  }

  set src(value) {
    this._src = value;
    queueMicrotask(() => this.onload && this.onload());
  }

  get src() {
    return this._src;
  }
}

class FakeAudio {
  constructor(src = "") {
    this.src = src;
    this.volume = 1;
    this.loop = false;
    this.currentTime = 0;
  }

  play() {
    // tests can check what was heard
    globalThis.__played.push(this.src.replace(/^.*\/audio\//, ""));
    return Promise.resolve();
  }

  cloneNode() {
    return new FakeAudio(this.src);
  }

  pause() {}

  addEventListener() {}
}

const store = new Map();
globalThis.__played = [];

globalThis.Image = FakeImage;
globalThis.Audio = FakeAudio;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
