/**
 * The board's rows fit the leaderboard modal on a landscape phone. The game is
 * landscape-only, so the narrowest real case is 568-667 px wide, where the
 * modal (.modal-narrow: min(520px, 94%), padding min(28px, 5vw)) leaves a
 * 464 px list; wider screens get the same 520 px modal. Each row is its own
 * grid, so its fixed columns, gaps and padding plus the widest score must
 * leave the name at least 80 px, which then truncates with an ellipsis.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const FONT = 16; // .lb-row font-size: an em in its columns
const LIST = 520 - 2 * 28; // the list's width at 568 to 1280 px
const SCORE = 72; // the widest score cell measured, "1234567" at 16 px
const NAME_MIN = 80;

/** The declarations of the top-level rule whose whole selector is `selector`. */
function rule(selector) {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, selectors]) => selectors.trim() === selector,
  );
  assert.ok(found.length > 0, `a ${selector} rule exists`);
  const out = {};
  for (const [, , body] of found) {
    for (const decl of body.split(";")) {
      const i = decl.indexOf(":");
      if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
  }
  return out;
}

const px = (value) => {
  const m = /^([\d.]+)(px|em)$/.exec(value);
  assert.ok(m, `"${value}" is a px or em length`);
  return m[2] === "em" ? Number(m[1]) * FONT : Number(m[1]);
};

/** Columns of a grid-template-columns value, keeping minmax(...) whole. */
const columns = (value) => value.match(/minmax\([^)]*\)|\S+/g);

function layout(selector) {
  const row = { ...rule(".lb-row"), ...(selector === ".lb-row" ? {} : rule(selector)) };
  const cols = columns(row["grid-template-columns"]);
  const name = cols.findIndex((c) => c.startsWith("minmax("));
  assert.ok(name >= 0, `${selector}: the name column is a minmax()`);
  const padding = row.padding.split(/\s+/).map(px);
  const sides = padding.length === 1 ? 2 * padding[0] : 2 * padding[1];
  const gaps = (cols.length - 1) * px(row.gap);
  const fixed = cols
    .filter((c, i) => i !== name && c !== "auto")
    .reduce((sum, c) => sum + px(c), 0);
  const autos = cols.filter((c) => c === "auto").length;
  return { cols, name: cols[name], left: LIST - sides - gaps - fixed - autos * SCORE, autos };
}

for (const selector of [".lb-row", ".lb-row.endless"]) {
  test(`${selector}: the name keeps at least ${NAME_MIN} px in a ${LIST} px list`, () => {
    const { name, left, autos } = layout(selector);
    assert.equal(name, `minmax(${NAME_MIN}px, 1fr)`);
    assert.equal(autos, 1, "only the score sizes to its content");
    assert.ok(left >= NAME_MIN, `${selector}: ${left.toFixed(1)} px left for the name`);
  });
}

test("the daily and endless rows have the same columns, plus the level on endless", () => {
  const daily = layout(".lb-row").cols;
  const endless = layout(".lb-row.endless").cols;
  assert.equal(endless.length, daily.length + 1);
  assert.deepEqual([...endless.slice(0, 3), ...endless.slice(4)], daily);
});

test("a long name truncates with an ellipsis; the other cells never wrap", () => {
  const name = rule(".lb-name");
  assert.equal(name.overflow, "hidden");
  assert.equal(name["text-overflow"], "ellipsis");
  assert.equal(name["white-space"], "nowrap");
  for (const cell of [".lb-seen", ".lb-level"]) assert.equal(rule(cell)["white-space"], "nowrap");
  assert.equal(rule(".lb-score,\n.lb-time")["white-space"], "nowrap");
});

test("the last-online column fits its widest label", () => {
  // "Yesterday" at the cell's 12 px is about 54 px wide
  const seen = rule(".lb-seen");
  assert.equal(seen["font-size"], "12px");
  const { cols } = layout(".lb-row");
  assert.ok(px(cols[cols.length - 1]) >= 56, `the seen column is ${cols[cols.length - 1]}`);
});
