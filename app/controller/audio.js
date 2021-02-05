export default class AudioController {
  constructor() {
    this.audios = {};
  }

  play(key, ext = "wav") {
    if (!this.audios[key]) {
      this.audios[key] = new Audio(`./assets/audio/${key}.${ext}`);
    }

    this.audios[key].play();
  }
}
