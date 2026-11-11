import { CONTROL_IDS, clampToScreen, toFractions } from "./layout";
import { createLayoutEditor } from "./layout-editor";

const viewport = () => ({
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

const sizeOf = (el) => ({ width: el.offsetWidth, height: el.offsetHeight });

const PLACED = ["position", "left", "top", "margin"];

/**
 * Puts each control of `layout` at its place, `position: fixed` and out of its
 * flex row, held on screen inside `safeArea`. A null layout (or a control it
 * has no place for) leaves the CSS default.
 */
export function applyControlLayout(layout, safeArea) {
  const view = viewport();
  CONTROL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const place = layout && layout[id];
    if (!place) {
      PLACED.forEach((name) => el.style.removeProperty(name));
    } else {
      const at = clampToScreen(place, sizeOf(el), view, safeArea);
      el.style.position = "fixed";
      el.style.margin = "0";
      el.style.left = `${at.left}px`;
      el.style.top = `${at.top}px`;
    }
    // the pause button's holder is centred with a transform, which would make
    // it the reference for a fixed button inside it
    if (id === "pauseBtn") el.parentElement.style.transform = place ? "none" : "";
  });
}

/** Where the CSS puts each control now, as shares of the viewport. */
function measureDefaults(layout, safeArea) {
  applyControlLayout(null, safeArea);
  const view = viewport();
  const out = {};
  CONTROL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    const box = el.getBoundingClientRect();
    out[id] = toFractions(box.left, box.top, sizeOf(el), view);
  });
  applyControlLayout(layout, safeArea);
  return out;
}

/**
 * The layout editor on `root` (#layoutEditor): the five controls as handles to
 * drag, and the Save, Reset and Cancel buttons.
 *
 *   getLayout   () => the saved layout or null
 *   safeArea    () => { top, right, bottom, left } in px
 *   onSave      (layout | null) => void, called before the editor closes
 *   onClose     called whenever the editor closes
 * Returns { open }.
 */
export function mountLayoutEditor({ root, getLayout, safeArea, onSave, onClose }) {
  const field = root.querySelector(".layout-field");
  const button = (id) => root.querySelector(`#${id}`);
  let stop = () => {};

  const open = () => {
    const saved = getLayout();
    const insets = safeArea();
    // the real controls are covered by the editor, and only copied here
    const sizes = {};
    CONTROL_IDS.forEach((id) => (sizes[id] = sizeOf(document.getElementById(id))));
    const defaults = () => measureDefaults(saved, insets);
    let closed = false;

    const editor = createLayoutEditor({
      initial: saved,
      defaults,
      onSave: (layout) => {
        onSave(layout);
        close();
      },
      onCancel: () => close(),
    });

    const handles = {};
    CONTROL_IDS.forEach((id) => {
      const real = document.getElementById(id);
      const handle = document.createElement("div");
      handle.className = "layout-handle flex-item";
      handle.dataset.id = id;
      handle.innerHTML = real.innerHTML;
      handle.style.width = `${sizes[id].width}px`;
      handle.style.height = `${sizes[id].height}px`;
      field.appendChild(handle);
      handles[id] = handle;
      bindDrag(id, handle);
    });

    const render = () => {
      const view = viewport();
      const inset = safeArea();
      CONTROL_IDS.forEach((id) => {
        const at = clampToScreen(editor.positions[id], sizes[id], view, inset);
        handles[id].style.left = `${at.left}px`;
        handles[id].style.top = `${at.top}px`;
      });
    };

    function bindDrag(id, handle) {
      let grab = null;
      handle.onpointerdown = (e) => {
        e.preventDefault();
        const box = handle.getBoundingClientRect();
        grab = {
          x: e.clientX - (box.left + box.width / 2),
          y: e.clientY - (box.top + box.height / 2),
        };
        handle.setPointerCapture(e.pointerId);
        handle.classList.add("dragging");
      };
      handle.onpointermove = (e) => {
        if (!grab) return;
        const view = viewport();
        const wanted = {
          x: (e.clientX - grab.x) / view.width,
          y: (e.clientY - grab.y) / view.height,
        };
        const at = clampToScreen(wanted, sizes[id], view, safeArea());
        editor.move(id, toFractions(at.left, at.top, sizes[id], view));
        render();
      };
      const release = () => {
        grab = null;
        handle.classList.remove("dragging");
      };
      handle.onpointerup = release;
      handle.onpointercancel = release;
    }

    function close() {
      if (closed) return;
      closed = true;
      stop();
      stop = () => {};
      Object.values(handles).forEach((h) => h.remove());
      root.style.visibility = "hidden";
      onClose();
    }

    button("layoutSaveBtn").onclick = () => editor.save();
    button("layoutResetBtn").onclick = () => {
      editor.reset();
      render();
    };
    button("layoutCancelBtn").onclick = () => editor.cancel();
    window.addEventListener("resize", render);
    stop = () => window.removeEventListener("resize", render);

    render();
    root.style.visibility = "visible";
  };

  return { open };
}
