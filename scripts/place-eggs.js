/**
 * Gives each non-boss story area its hidden egg: an `egg: { id, left, top }`
 * field (tiles, like coins) added to the area file. Nothing else in a file
 * changes, so a shipped layout stays as it was. Re-running is a no-op.
 *
 *   node scripts/place-eggs.js
 *   node scripts/place-eggs.js --dir <areas folder> --hand-spots <json file>
 *
 * Generated levels get the spot `eggSpot` picks (app/rewards/egg-spot.js);
 * the hand-made ones (Grassland 1-3, Iceland 1-2) use HAND_SPOTS. A spot that
 * fails `eggReachable` stops the script and names the area.
 * scripts/generate-levels.js runs this after it writes the generated areas.
 */
const fs = require("fs");
const path = require("path");

/** The non-boss story areas: Grassland 1-3, Iceland 1-2, then generated 9-24 and 26/28/30/32. */
const STORY_AREAS = [1, 2, 3, 7, 8, ...range(9, 24), 26, 28, 30, 32];

/** Hand-picked spots for the hand-made levels: on a high platform, clear of coins and enemies. */
const HAND_SPOTS = {
  1: { left: 15.25, top: 1.1 },
  2: { left: 7.25, top: 3.1 },
  3: { left: 16.25, top: 1.1 },
  7: { left: 15.25, top: 4.1 },
  8: { left: 8.25, top: 1.1 },
};

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// an egg is a flat object, so the field ends at its first closing brace
const EGG_FIELD = /,\n {2}"egg": \{[^{}]*\}/;

/** The file's text with its egg field set to `egg` and every other byte as it was. */
function withEgg(text, egg) {
  const bare = text.replace(EGG_FIELD, "");
  const end = bare.lastIndexOf("}");
  if (end < 0) throw new Error("not a JSON object");
  const field = JSON.stringify(egg, null, 2).replace(/\n/g, "\n  ");
  return `${bare.slice(0, end).trimEnd()},\n  "egg": ${field}\n${bare.slice(end)}`;
}

async function placeEggs({ outDir, handSpots = HAND_SPOTS } = {}) {
  const { eggSpot, eggReachable } = await import("../app/rewards/egg-spot.js");
  const dir = outDir || path.resolve(__dirname, "../app/areas");
  const changed = [];
  for (const id of STORY_AREAS) {
    const file = path.join(dir, `area-${id}.json`);
    const text = fs.readFileSync(file, "utf8");
    const area = JSON.parse(text);
    const hand = handSpots[id];
    const spot = hand || eggSpot(area, id);
    if (!eggReachable(area, spot)) {
      throw new Error(`area ${id}: no reachable spot for its egg${hand ? " (hand spot)" : ""}`);
    }
    const next = withEgg(text, { id: `s${id}`, left: spot.left, top: spot.top });
    if (next !== text) {
      fs.writeFileSync(file, next);
      changed.push(id);
    }
  }
  return changed;
}

module.exports = { placeEggs, STORY_AREAS, HAND_SPOTS };

if (require.main === module) {
  const arg = (name) => {
    const at = process.argv.indexOf(name);
    return at >= 0 ? process.argv[at + 1] : undefined;
  };
  const handFile = arg("--hand-spots");
  placeEggs({
    outDir: arg("--dir") && path.resolve(arg("--dir")),
    handSpots: handFile ? JSON.parse(fs.readFileSync(handFile, "utf8")) : HAND_SPOTS,
  })
    .then((changed) =>
      console.log(
        changed.length ? `eggs placed in areas ${changed.join(", ")}` : "eggs up to date",
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
