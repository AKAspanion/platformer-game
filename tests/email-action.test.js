import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  readAction,
  actionError,
  sameOriginPath,
  BROKEN_LINK,
  MODES,
} from "../app/auth/email-action";

const ORIGIN = "https://dino.spanion.in";
const root = process.cwd();
const link = (params) => `?${new URLSearchParams(params)}`;

test("readAction: each mode with its code, and where the player goes next", () => {
  const verify = readAction(
    link({
      mode: "verifyEmail",
      oobCode: "abc",
      apiKey: "k",
      continueUrl: `${ORIGIN}/?verified=1`,
      lang: "en",
    }),
    ORIGIN,
  );
  assert.deepEqual(verify, { mode: "verifyEmail", oobCode: "abc", next: "/?verified=1" });

  // without a continueUrl, each mode still lands somewhere sensible
  assert.equal(readAction(link({ mode: "resetPassword", oobCode: "x" }), ORIGIN).next, "/?reset=1");
  assert.equal(
    readAction(link({ mode: "verifyEmail", oobCode: "x" }), ORIGIN).next,
    "/?verified=1",
  );
  assert.equal(readAction(link({ mode: "recoverEmail", oobCode: "x" }), ORIGIN).next, "/");
  for (const mode of MODES)
    assert.equal(readAction(link({ mode, oobCode: "x" }), ORIGIN).mode, mode);
});

test("readAction: never sends the player to another site", () => {
  for (const continueUrl of [
    "https://evil.example/?verified=1",
    "//evil.example/",
    "javascript:alert(1)",
    "http://dino.spanion.in/?reset=1",
  ]) {
    const action = readAction(link({ mode: "resetPassword", oobCode: "x", continueUrl }), ORIGIN);
    assert.equal(action.next, "/?reset=1", continueUrl);
  }
  assert.equal(sameOriginPath(`${ORIGIN}/w/wabc?x=1#y`, ORIGIN), "/w/wabc?x=1#y");
  assert.equal(sameOriginPath("not a url at all", ORIGIN), "/not%20a%20url%20at%20all");
  assert.equal(sameOriginPath("", ORIGIN), null);
});

test("readAction: a link without a known mode or a code is broken", () => {
  for (const params of [
    {},
    { mode: "verifyEmail" },
    { oobCode: "x" },
    { mode: "signIn", oobCode: "x" },
    { mode: "toString", oobCode: "x" },
  ]) {
    assert.deepEqual(readAction(link(params), ORIGIN), { error: BROKEN_LINK });
  }
});

test("actionError: dead links are explained, the rest is friendly", () => {
  assert.match(actionError({ code: "auth/expired-action-code" }), /expired/);
  assert.match(actionError({ code: "auth/invalid-action-code" }), /already used/);
  assert.equal(
    actionError({ code: "auth/weak-password" }),
    "Use a password with at least 6 characters.",
  );
  assert.equal(
    actionError({ code: "auth/network-request-failed" }),
    "No connection. Check your internet and try again.",
  );
  assert.equal(
    actionError({ code: "auth/internal-error", message: "Firebase: Error (auth/internal-error)." }),
    "Something went wrong. Try again.",
  );
});

test("the build ships the game's own 404 and account email pages", () => {
  const config = fs.readFileSync(path.join(root, "webpack.config.js"), "utf8");
  for (const file of ["404.html", "auth-action.html", "pages.css"]) {
    assert.ok(fs.existsSync(path.join(root, "app/pages", file)), file);
    assert.ok(config.includes(`app/pages/${file}`), `${file} is copied to dist`);
  }
  assert.ok(config.includes("app/pages/auth-action.js"), "the email page has its own entry");

  const page = fs.readFileSync(path.join(root, "app/pages/404.html"), "utf8");
  assert.ok(page.includes("Dino's Adventure"));
  // Hosting serves 404.html at any depth: relative URLs would break there
  const urls = [...page.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) assert.match(url, /^(\/|https:\/\/)/, url);
  // what a player sees (the body; the file's notes sit above it) never mentions Firebase
  const body = page.slice(page.indexOf("<body>"));
  assert.ok(body.includes("Wrong turn"));
  assert.ok(!/firebase/i.test(body));
});
