/**
 * Writes the generated story levels (app/pcg/generator.js -> LEVELS) to
 * app/areas and points the hand-made neighbours' portals at them.
 *
 * Usage:
 *   node scripts/generate-levels.js            # write all levels in LEVELS
 *   node scripts/generate-levels.js --print    # also print an ASCII preview
 *
 * The generator itself lives in app/pcg so the game can also build levels at
 * runtime (endless, daily and custom worlds).
 */
const fs = require("fs");
const path = require("path");
const { placeEggs } = require("./place-eggs");

const TILE = 16;
const COLS = 21;

/**
 * Update one portal of an existing (hand-made) area in place, editing only the
 * changed numbers so the file's formatting is preserved.
 */
function linkNeighbour(outDir, areaId, direction, values) {
  const file = path.join(outDir, `area-${areaId}.json`);
  let text = fs.readFileSync(file, "utf8");
  const blockRe = /\{[^{}]*"direction":\s*(-?\d+)[^{}]*\}/g;
  let match;
  while ((match = blockRe.exec(text))) {
    if (Number(match[1]) !== direction) continue;
    let block = match[0];
    Object.entries(values).forEach(([key, value]) => {
      block = block.replace(new RegExp(`"${key}":\\s*-?[\\d.]+`), `"${key}": ${value}`);
    });
    text = text.slice(0, match.index) + block + text.slice(match.index + match[0].length);
    fs.writeFileSync(file, text);
    return;
  }
  throw new Error(`area ${areaId}: no portal with direction ${direction}`);
}

async function main() {
  const { buildAll, ascii } = await import("../app/pcg/generator.js");
  const print = process.argv.includes("--print");
  const outDir = path.resolve(__dirname, "../app/areas");
  const results = buildAll();

  // Hand-made neighbours: point their portal into this level at the right height.
  Object.values(results).forEach(({ data, heights }) => {
    data.portals.forEach((portal) => {
      if (results[portal.destinationArea]) return;
      if (portal.destinationArea == null || portal.destinationArea < 0) return; // edge / finish
      const fromLeft = portal.direction < 0; // we exit left, so they enter us from their right
      linkNeighbour(outDir, portal.destinationArea, fromLeft ? 1 : -1, {
        destinationArea: data.id,
        destinationX: fromLeft ? 16 : 330,
        destinationY: heights[fromLeft ? 0 : COLS - 1] * TILE - 8,
      });
    });
  });

  Object.values(results).forEach((result) => {
    const { data, seed } = result;
    const file = path.join(outDir, `area-${data.id}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    console.log(
      `area-${data.id}.json  seed=${seed}  coins=${data.coins.length}  enemies=${data.enemies.length}  pits=${data.death.length}  left=${result.heights[0]} right=${result.heights[COLS - 1]}`,
    );
    if (print) console.log(ascii(result) + "\n");
  });

  // each non-boss story area gets its hidden egg (an `egg` field, nothing else changes)
  const placed = await placeEggs({ outDir });
  if (placed.length) console.log(`eggs placed in areas ${placed.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
