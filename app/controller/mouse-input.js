export default class MouseInput {
  constructor(id, action) {
    this.holdit(document.getElementById(id), action, 500, 2);
  }

  holdit(btn, action, start, speedup) {
    let timeout;

    let repeat = function () {
      action("keydown");

      timeout = setTimeout(repeat, start);
      start = start / speedup;
    };

    btn.onmousedown = function () {
      repeat();
    };

    btn.onmouseup = function () {
      action("keyup");

      clearTimeout(timeout);
    };
  }
}
