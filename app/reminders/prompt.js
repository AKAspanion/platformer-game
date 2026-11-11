/**
 * When to ask for daily reminders: once, after the first daily result panel.
 * The answer is kept in localStorage under "reminder_prompt".
 *
 *   prompt.shouldAsk()  -> true until answered once
 *   prompt.answer(yes)  -> remembers that the player answered
 */
const KEY = "reminder_prompt";

export function createPrompt(storage = localStorage) {
  let answered = false; // also holds when the storage is blocked

  const stored = () => {
    try {
      const value = JSON.parse(storage.getItem(KEY));
      return (
        !!value && typeof value === "object" && (value.answer === "yes" || value.answer === "no")
      );
    } catch (error) {
      return false; // unreadable: same as never asked
    }
  };

  return {
    shouldAsk: () => !answered && !stored(),
    answer(yes) {
      answered = true;
      try {
        storage.setItem(KEY, JSON.stringify({ answer: yes ? "yes" : "no" }));
      } catch (error) {
        // blocked storage: remembered for this visit only
      }
    },
  };
}
