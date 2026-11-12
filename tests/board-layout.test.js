/**
 * The board's rows fit the leaderboard on a landscape phone. The game is
 * landscape-only, so the narrowest real case is 568 x 320: the modal screen's
 * 16 px margins and the short-screen modal padding (12 px) leave the list the
 * rest of the width. Each row is its
 * own grid, so its fixed columns, gaps and padding plus the widest score must
 * leave the name at least 80 px, which then truncates with an ellipsis.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const SCREEN = 568;
const LIST = SCREEN - 2 * 16 - 2 * 12 - 2 * 2; // the list's inner width
const SCORE = 84; // the widest score pill measured, "★ 1234567" at 16 px
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
  const m = /^([\d.]+)px$/.exec(value);
  assert.ok(m, `"${value}" is a px length`);
  return Number(m[1]);
};

test(`a row's name keeps at least ${NAME_MIN} px in a ${LIST} px list`, () => {
  const row = rule(".lb-row");
  const cols = row["grid-template-columns"].match(/minmax\([^)]*\)|\S+/g);
  const name = cols.findIndex((c) => c.startsWith("minmax("));
  assert.equal(cols[name], `minmax(${NAME_MIN}px, 1fr)`);
  assert.equal(cols.filter((c) => c === "auto").length, 1, "only the score sizes to its content");
  const [, right, , left] = row.padding.split(/\s+/).map(px);
  const fixed = cols.filter((c, i) => i !== name && c !== "auto").reduce((s, c) => s + px(c), 0);
  const room = LIST - left - right - (cols.length - 1) * px(row.gap) - fixed - SCORE;
  assert.ok(room >= NAME_MIN, `${room} px left for the name`);
});

test("the list takes the modal's whole width: no column beside it", () => {
  const body = /\.lb-body \{([^}]*)\}/.exec(css)[1];
  assert.match(body, /flex-direction: column;/);
  assert.doesNotMatch(body, /grid-template-columns/);
});

test("a long name truncates with an ellipsis; the other cells never wrap", () => {
  const name = rule(".lb-name");
  assert.equal(name.overflow, "hidden");
  assert.equal(name["text-overflow"], "ellipsis");
  assert.equal(name["white-space"], "nowrap");
  assert.equal(rule(".lb-seen")["white-space"], "nowrap");
  assert.equal(rule(".lb-score")["white-space"], "nowrap");
});
