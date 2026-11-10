export default class MouseInput {
  constructor(id, action) {
    this.actions = this.bind(document.getElementById(id), action);
  }

  bind(btn, action) {
    const preventDefault = (e) => {
      if (e.preventDefault) {
        e.preventDefault();
      }
    };

    const release = (e) => {
      preventDefault(e);
      action("keyup");
    };

    try {
      btn.ontouchstart = (e) => {
        preventDefault(e);
        action("keydown");
      };
      // touchcancel fires when the OS interrupts a touch (notification, system
      // gesture); without it the key stays held and the dino runs forever.
      btn.ontouchend = release;
      btn.ontouchcancel = release;
    } catch (error) {
      console.error("Error in mouse input", error);
    }
    return { clear: () => {} };
  }
}
