import { CONTROL_IDS, normalizeLayout } from "./layout";

const isShare = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/**
 * The state of the layout editor, with no screen in it: where each of the five
 * controls is now, and what Save, Reset and Cancel do. The shell draws it.
 *
 *   initial   the saved layout (or null)
 *   defaults  () => { [id]: { x, y } }, the places the CSS puts the controls
 *   onSave    called with the layout to keep, or null for "the default"
 *   onCancel  called when the editor closes without saving
 */
export function createLayoutEditor({ initial = null, defaults, onSave, onCancel }) {
  const saved = normalizeLayout(initial);
  const place = (id, layout) => ({ ...(layout && layout[id] ? layout[id] : defaults()[id]) });
  const all = (layout) => Object.fromEntries(CONTROL_IDS.map((id) => [id, place(id, layout)]));

  const editor = {
    open: true,
    // true while the controls are at the default places, so Save stores null
    atDefault: !saved,
    positions: all(saved),

    move(id, { x, y }) {
      if (!editor.open || !CONTROL_IDS.includes(id) || !isShare(x) || !isShare(y)) return;
      editor.positions[id] = { x, y };
      editor.atDefault = false;
    },

    reset() {
      if (!editor.open) return;
      editor.positions = all(null);
      editor.atDefault = true;
    },

    save() {
      if (!editor.open) return;
      editor.open = false;
      onSave(editor.atDefault ? null : normalizeLayout(editor.positions));
    },

    cancel() {
      if (!editor.open) return;
      editor.open = false;
      if (onCancel) onCancel();
    },
  };
  return editor;
}
