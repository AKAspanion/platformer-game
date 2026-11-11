/** Display names: letters, digits, spaces and a little punctuation, at most 20 chars. */
export const cleanName = (name) =>
  String(name || "")
    .replace(/[^A-Za-z0-9À-ɏ ._'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20)
    .trim();

export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
