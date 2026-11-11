import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every top-level `@media (...) { ... }` block: { query, body }. */
function mediaBlocks() {
  const blocks = [];
  for (const m of css.matchAll(/@media\s*([^{]+)\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    while (depth && i < css.length) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push({ query: m[1].trim(), body: css.slice(from, i - 1) });
  }
  return blocks;
}

/** The declarations of every rule in `body` whose selector list includes `selector`. */
const declarations = (body, selector) =>
  [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((s) => s.trim() === selector))
    .map(([, , decl]) => decl);

test("the mode cards go two to a row only below 561 px wide", () => {
  const twoUp = mediaBlocks().filter(({ body }) =>
    declarations(body, ".mode-grid").some((d) => /grid-template-columns:\s*repeat\(2/.test(d)),
  );
  assert.ok(twoUp.length > 0, "the narrow rule exists");
  twoUp.forEach(({ query }) => {
    assert.match(query, /^\(max-width:\s*560px\)$/, `a 2-column mode grid under "${query}"`);
  });
});
