export default class MouseInput {
  constructor(id, action) {
    this.actions = this.holdit(document.getElementById(id), action, 1000, 2);
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

    const repeat = function () {
      action("keydown");

      timeout = setTimeout(repeat, start);
      start = start / speedup;
    };

    try {
      btn.ontouchstart = function (e) {
        preventDefault(e);

        btn.style.background = "linear-gradient(145deg, #262d2c, #36413e)";

        repeat();
      };

      btn.ontouchend = function (e) {
        preventDefault(e);
        action("keyup");

        btn.style.background = "linear-gradient(145deg, #36413e, #262d2c)";

        clear();
      };
    } catch (error) {
      console.error("Error in mouse input", error);
    }
    return { clear };
  }
}
