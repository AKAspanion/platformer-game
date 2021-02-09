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
    try {
      if (!this.audios[key]) {
        this.audios[key] = new Audio(`./assets/audio/${key}.${ext}`);
      }

      this.audios[key].volume = 0.5;
      this.audios[key].play();
    } catch (error) {}

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
}
