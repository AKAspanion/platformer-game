/**
 * `?level=` opens a campaign level straight away (test hosts only, see app/index.js):
 * an area id (`?level=9`, which is also its place in the campaign) or its name
 * (`?level=iceland-3`, `?level=Iceland 3`).
 */

const slug = (text) =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

/** The level in `levels` that `search` (location.search) names with ?level=, or null. */
export function levelFromQuery(search, levels) {
  let value;
  try {
    value = new URLSearchParams(search).get("level");
  } catch (error) {
    return null;
  }
  if (!value || !value.trim()) return null;
  const wanted = slug(value);
  if (/^\d+$/.test(wanted)) return levels.find((level) => level.id === Number(wanted)) || null;
  return levels.find((level) => slug(level.name) === wanted) || null;
}
