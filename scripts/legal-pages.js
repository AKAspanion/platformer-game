/**
 * Builds the game's legal pages from the Markdown at the repo root:
 *
 *   PRIVACY.md -> dist/privacy.html  (served at /privacy)
 *   TERMS.md   -> dist/terms.html    (served at /terms)
 *
 * The Markdown stays the single source (the tests read it); webpack's
 * CopyPlugin calls renderLegalPage to wrap it in app/pages/legal.html.
 */
const fs = require("fs");
const path = require("path");
const { Marked } = require("marked");

const TEMPLATE = path.join(__dirname, "..", "app", "pages", "legal.html");

const LEGAL_PAGES = [
  { source: "PRIVACY.md", file: "privacy.html", route: "/privacy", title: "Privacy Policy" },
  { source: "TERMS.md", file: "terms.html", route: "/terms", title: "Terms of Service" },
];

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// The documents are ours, but raw HTML in them is shown as text, never run.
// (marked 13 passes the html renderer the raw string.)
const markdown = new Marked({ renderer: { html: (html) => escapeHtml(html) } });

const renderLegalPage = (source, { title }, template = fs.readFileSync(TEMPLATE, "utf8")) => {
  // The document's first line is its heading; the page shows `title` instead.
  const body = source.replace(/^[^\n]*\n/, "");
  const html = markdown.parse(body, { async: false });
  return template.replaceAll("{{title}}", escapeHtml(title)).replace("{{content}}", () => html);
};

module.exports = { LEGAL_PAGES, renderLegalPage };
