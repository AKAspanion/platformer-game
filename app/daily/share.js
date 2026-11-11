/**
 * The daily result card: the text a player shares, and the share itself.
 */
import { seedToDate } from "./rules.js";

const SQUARES = { clean: "🟩", hurt: "🟨", lost: "🟥", unreached: "⬛" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GAME_URL = "https://dino.spanion.in";

/** "11 Nov 2026" for a seed (English month, no locale dependence). */
function formatSeed(seed) {
  const date = seedToDate(seed);
  if (!date) return String(seed);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "4,320": a comma every three digits, whatever the locale. */
function formatScore(score) {
  return String(Math.round(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "3:41" for 221 seconds. */
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const rest = String(total % 60).padStart(2, "0");
  return `${Math.floor(total / 60)}:${rest}`;
}

export function shareText({ seed, levels, score, seconds, rank, total, streak }) {
  const squares = levels.map((result) => SQUARES[result] || SQUARES.unreached).join("");
  let scoreLine = `Score ${formatScore(score)} · ${formatTime(seconds)}`;
  if (Number.isFinite(rank) && Number.isFinite(total)) scoreLine += ` · #${rank} of ${total}`;
  const lines = [`Dino's Adventure Daily · ${formatSeed(seed)}`, squares, scoreLine];
  if (streak >= 2) lines.push(`🔥 ${streak}-day streak`);
  lines.push(GAME_URL);
  return lines.join("\n");
}

/** Opens the share sheet, or copies to the clipboard. Never throws. */
export async function shareRun(text, nav = typeof navigator === "undefined" ? {} : navigator) {
  try {
    if (typeof nav.share === "function") {
      try {
        await nav.share({ text });
        return "share";
      } catch (err) {
        // The player closed the sheet: that is their answer, not a reason to copy.
        if (err && err.name === "AbortError") return "failed";
      }
    }
    await nav.clipboard.writeText(text);
    return "copy";
  } catch {
    return "failed";
  }
}
