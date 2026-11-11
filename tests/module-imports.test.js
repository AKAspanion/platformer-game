import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const APP = path.join(root, "app");

/**
 * A folder whose package.json says "type": "module" makes webpack resolve its
 * imports as fully specified, so every relative import there needs its file
 * extension. esbuild (the unit tests) doesn't care, so this pins it.
 */
const strictFolders = fs
  .readdirSync(APP, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(APP, d.name))
  .filter((dir) => {
    const pkg = path.join(dir, "package.json");
    return fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, "utf8")).type === "module";
  });

const FROM =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["'](\.[^"']*)["']|import\(\s*["'](\.[^"']*)["']\s*\)/g;

test("the strict ES module folders are found", () => {
  assert.ok(strictFolders.some((dir) => dir.endsWith(path.join("app", "rewards"))));
});

for (const dir of strictFolders) {
  test(`${path.relative(root, dir)}: relative imports carry their extension`, () => {
    const bad = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      for (const m of text.matchAll(FROM)) {
        const spec = m[1] || m[2];
        if (!/\.(js|mjs|json)$/.test(spec)) bad.push(`${file}: ${spec}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}
