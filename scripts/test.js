/**
 * Runs the headless game tests in tests/*.test.js.
 *
 *   yarn test
 *
 * The game code is browser ES modules with extensionless and JSON imports, so
 * each test file is bundled with esbuild first and then run with `node --test`.
 * tests/env.js stubs the browser globals the game touches (Image, Audio,
 * localStorage).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const testDir = path.join(root, "tests");
const outDir = path.join(root, "node_modules", ".cache", "dino-tests");

const only = process.argv.slice(2);
const entries = fs
  .readdirSync(testDir)
  .filter((file) => file.endsWith(".test.js"))
  .filter((file) => !only.length || only.some((name) => file.includes(name)))
  .map((file) => path.join(testDir, file));

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
