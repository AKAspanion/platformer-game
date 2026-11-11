/** The home screen's coin balance sits inside the Shop button. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("app/index.html", "utf8");
const js = fs.readFileSync("app/index.js", "utf8");
const css = fs.readFileSync("app/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const shopButton = () => {
  const m = /<button id="shopBtn"[\s\S]*?<\/button>/.exec(html);
  assert.ok(m, "the Shop button exists");
  return m[0];
};

test("the coin balance is inside the Shop button, with the coin sprite", () => {
  const button = shopButton();
  assert.match(button, /id="walletBalance"/);
  assert.match(button, /class="coin-icon"/);
  assert.match(button, />\s*Shop\s*</);
});

test("no separate coin chip is left in the home wallet row", () => {
  const row = /<div class="wallet-row">[\s\S]*?<\/div>/.exec(html)[0];
  assert.equal(
    (row.match(/id="walletBalance"/g) || []).length,
    1,
    "one balance, the Shop button's",
  );
  assert.doesNotMatch(row.replace(shopButton(), ""), /coin-chip/);
});

test("the Shop button's label carries the balance for screen readers", () => {
  assert.match(js, /\$\("shopBtn"\)\.setAttribute\(\s*"aria-label",\s*`Shop, \$\{[^}]+\} coins`/);
});

test("the balance inside Shop is a small gold pill", () => {
  assert.match(css, /\.shop-coins\s*\{[^}]*color:\s*var\(--gold\)/);
});
