import { getData } from "../util/";
import { audioSrc } from "../util/registry";
const oneShots = {}; // url -> the element downloaded the first time it played

export default class AudioController {
  constructor() {
    this.count = 4;
    this.audios = {};
  }

  static play(key, ext = "wav", volume = 0.4) {
    if (getData("mute_sounds")) return;

    try {
      const src = audioSrc(key, ext);
      // requested on first play only; later plays copy the downloaded sound
      const base = oneShots[src];
      const audio =
        base && base.cloneNode ? base.cloneNode() : base || (oneShots[src] = new Audio(src));
      audio.volume = volume;
      // play() rejects when the browser blocks autoplay; a missed sound is fine
      const playing = audio.play();
      if (playing && playing.catch) playing.catch(() => {});
    } catch (error) {
      // no audio (blocked, or the file failed to load): the game goes on
    }
  }

  play(key, ext = "wav") {
    try {
      if (!this.audios[key]) {
        this.audios[key] = new Audio(audioSrc(key, ext));
      }

      this.audios[key].volume = 0.4;

      if (getData("mute_music")) return;

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

    filteredAudios.forEach(({ file, ext = "mp3" }) => {
      this.audios[file] = new Audio();
      this.audios[file].addEventListener("canplaythrough", onload, { once: true });
      this.audios[file].addEventListener("error", onload, { once: true });
      this.audios[file].src = audioSrc(file, ext);
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
