/**
 * Copies the game's world validation (app/worlds/spec.js) into
 * functions/shared/, because a functions deploy only uploads functions/.
 *
 *   node scripts/sync-functions-shared.js          copy
 *   node scripts/sync-functions-shared.js --check  fail if the copy is stale
 *
 * Runs before every functions deploy (firebase.json predeploy); CI runs the
 * check so the server never validates worlds differently from the game.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "app", "worlds", "spec.js");
const target = path.join(root, "functions", "shared", "spec.js");
const header =
  "// GENERATED from app/worlds/spec.js by scripts/sync-functions-shared.js. Do not edit.\n";
const wanted = header + fs.readFileSync(source, "utf8");

if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== wanted) {
    console.error("functions/shared/spec.js is stale: run node scripts/sync-functions-shared.js");
    process.exit(1);
  }
  console.log("functions/shared/spec.js is up to date");
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, wanted);
  console.log("synced functions/shared/spec.js");
}
