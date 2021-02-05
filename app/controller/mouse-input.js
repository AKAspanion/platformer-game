export default class MouseInput {
  constructor(id, action) {
    this.actions = this.holdit(document.getElementById(id), action, 1000, 2);
  }

  holdit(btn, action, start, speedup) {
    let timeout;

    const clear = () => {
      clearTimeout(timeout);
    };

    const repeat = function () {
      action("keydown");

      timeout = setTimeout(repeat, start);
      start = start / speedup;
    };

    btn.onpointerdown = function () {
      repeat();
    };

    btn.onpointerup = function () {
      action("keyup");

      clear();
    };

    btn.onmouseup = function () {
      action("keyup");

      clear();
    };

    return { clear };
  }
}
