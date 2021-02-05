export default class AudioController {
  constructor() {
    this.audios = {};
  }

  static play(key, ext = "wav") {
    const audio = new Audio(`./assets/audio/${key}.${ext}`);
    audio.volume = 0.5;
    audio.play();
  }

  play(key, ext = "wav") {
    if (!this.audios[key]) {
      this.audios[key] = new Audio(`./assets/audio/${key}.${ext}`);
    }

    this.audios[key].volume = 0.5;
    this.audios[key].play();

    return this;
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
}
