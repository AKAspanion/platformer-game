import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LEGAL_PAGES, renderLegalPage } from "../scripts/legal-pages";

const read = (file) => fs.readFileSync(file, "utf8");
const template = read("app/pages/legal.html");
const render = (page) => renderLegalPage(read(page.source), page, template);
const byRoute = (route) => LEGAL_PAGES.find((page) => page.route === route);

test("/privacy, /terms and /delete-account are built from their Markdown", () => {
  assert.deepEqual(
    LEGAL_PAGES.map(({ source, file, route }) => [source, file, route]),
    [
      ["PRIVACY.md", "privacy.html", "/privacy"],
      ["TERMS.md", "terms.html", "/terms"],
      ["DELETE-ACCOUNT.md", "delete-account.html", "/delete-account"],
    ],
  );
  for (const page of LEGAL_PAGES) {
    const html = render(page);
    assert.match(html, new RegExp(`<title>${page.title} · Dino's Adventure</title>`));
    assert.match(html, new RegExp(`<h1 class="title">${page.title}</h1>`));
    assert.match(html, /<h3>Contact Us<\/h3>/);
    assert.match(html, /href="mailto:panditankit1995@gmail\.com"/);
    assert.ok(!html.includes("{{"), `${page.file} has an unfilled placeholder`);
  }
});

test("the policy and the terms link to each other", () => {
  assert.match(render(byRoute("/privacy")), /<a href="\/terms">Terms of Service<\/a>/);
  assert.match(render(byRoute("/terms")), /<a href="\/privacy">Privacy Policy<\/a>/);
});

test("the delete-account page gives the in-game steps, an email route and what is kept", () => {
  const page = read("DELETE-ACCOUNT.md");
  assert.match(page, /\*\*Settings\*\*/);
  assert.match(page, /\*\*Delete account\*\*/);
  assert.match(page, /mailto:panditankit1995@gmail\.com/);
  assert.match(page, /anonymous account/);
  assert.match(page, /### What is deleted/);
  assert.match(page, /### What is kept/);
  // every legal page links to it, and the policy points to it
  assert.match(render(byRoute("/privacy")), /<a href="\/delete-account">Delete your account<\/a>/);
  assert.match(read("PRIVACY.md"), /\(\/delete-account\)/);
});

test("the policy says what reminders store", () => {
  const policy = read("PRIVACY.md");
  assert.match(policy, /### Daily Reminders/);
  assert.match(policy, /push token/);
  assert.match(policy, /time zone/);
  assert.doesNotMatch(policy, /advertisements|in-game purchases|gmai\.com/);
});

test("raw HTML in the Markdown is shown as text, and $ patterns stay as written", () => {
  const html = renderLegalPage(
    "Title\n\n<script>alert(1)</script>\n\nCosts $& and $1.\n",
    { title: "T" },
    template,
  );
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Costs \$&amp; and \$1\./);
});

test("Hosting and the dev server serve both routes", () => {
  const hosting = JSON.parse(read("firebase.json")).hosting;
  for (const page of LEGAL_PAGES) {
    assert.ok(
      hosting.rewrites.some((r) => r.source === page.route && r.destination === `/${page.file}`),
      `firebase.json has no rewrite for ${page.route}`,
    );
  }
  const config = read("webpack.config.js");
  assert.match(config, /LEGAL_PAGES\.map\(\(page\) => \(\{\s*from: new RegExp/);
});

test("Settings links to both pages in a new tab", () => {
  const index = read("app/index.html");
  const row = index.slice(index.indexOf('id="legalRow"'), index.indexOf('id="legalRow"') + 600);
  for (const route of ["/privacy", "/terms"]) {
    const link = row.match(new RegExp(`<a[^>]*href="${route}"[^>]*>`));
    assert.ok(link, `Settings has no link to ${route}`);
    assert.match(link[0], /target="_blank"/);
    assert.match(link[0], /rel="noopener"/);
  }
});
