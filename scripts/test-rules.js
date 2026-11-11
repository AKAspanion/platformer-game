/**
 * Runs the Firestore rules tests in tests/rules/*.test.js against the emulator.
 *
 *   pnpm test:rules
 *
 * Meant to run inside `firebase emulators:exec` (the package script does), which
 * sets FIRESTORE_EMULATOR_HOST. Like scripts/test.js, each file is bundled with
 * esbuild and run with `node --test`; it reads only tests/rules, so `pnpm test`
 * never needs the emulator.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const testDir = path.join(root, "tests", "rules");
const outDir = path.join(root, "node_modules", ".cache", "dino-rules-tests");

const only = process.argv.slice(2);
const entries = (fs.existsSync(testDir) ? fs.readdirSync(testDir) : [])
  .filter((file) => file.endsWith(".test.js"))
  .filter((file) => !only.length || only.some((name) => file.includes(name)))
  .map((file) => path.join(testDir, file));

if (!entries.length) {
  console.log("No rules tests found in tests/rules.");
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
esbuild.buildSync({
  entryPoints: entries,
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: outDir,
  logLevel: "warning",
});

const outputs = entries.map((file) => path.join(outDir, path.basename(file)));
const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
process.exit(result.status === null ? 1 : result.status);
