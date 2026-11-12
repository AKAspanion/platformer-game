/**
 * The online features against the Firebase emulators: an email account from
 * sign-up to verified, the combined leaderboard (anonymous sign-in and a
 * callable function), and a community world read from Firestore and played.
 *
 * Chromium and WebKit run these at the same time on the same emulators, so
 * each test makes its own data (a unique email) or writes the same thing twice.
 */
const { test, expect } = require("./fixtures");
const { seedDoc, verifyLinkFor } = require("./emulators");
// a checked-in world (the unit tests use it too), seeded into the local emulator
const world = require("../tests/fixtures/sunny-coral-reef.json");

test("an email account signs up, verifies and shows in Settings", async ({
  page,
  openGame,
  request,
}, testInfo) => {
  const email = `dino-${testInfo.project.name}-${Date.now()}@example.com`;
  const name = `Rex${testInfo.project.name.slice(0, 3)}`;

  await openGame();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.locator("#settingsScreen");
  await expect(settings).toBeVisible();
  await expect(page.locator("#accountStatus")).toHaveText("Not signed in");
  await page.locator("#accountBtn").click();

  const login = page.locator("#loginScreen");
  await expect(login).toBeVisible();
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill("correct-horse-battery");
  await page.locator("#loginName").fill(name);
  await login.getByRole("button", { name: "Create account" }).click();

  // a new email account is asked to verify its address
  const verify = page.locator("#verifyScreen");
  await expect(verify).toBeVisible();
  await expect(page.locator("#verifyEmail")).toHaveText(email);
  await expect(login).toBeHidden();

  // not yet: the game says so
  await verify.getByRole("button", { name: "I've verified" }).click();
  await expect(page.locator("#verifyStatus")).toContainText("Not verified yet");

  // open the link the auth emulator "sent", then come back
  const link = await verifyLinkFor(email);
  expect((await request.get(link)).ok()).toBeTruthy();
  await verify.getByRole("button", { name: "I've verified" }).click();
  await expect(verify).toBeHidden();
  await expect(page.locator("#toast")).toContainText("Email verified");

  await expect(page.locator("#accountStatus")).toHaveText(name);
  await expect(page.locator("#accountBtn")).toHaveText("Sign out");
});

test("the combined leaderboard loads from the functions", async ({ page, openGame }) => {
  await openGame();
  await page.getByRole("button", { name: "Leaderboards" }).click();
  await expect(page.locator("#leaderboardScreen")).toBeVisible();
  // an empty board (getTotalBoard answered), not "Leaderboard didn't load."
  await expect(page.locator("#leaderboardStatus")).toHaveText(
    "No scores yet. Finish a level to be the first!",
  );
  await expect(page.locator("#leaderboardRetryBtn")).toBeHidden();
  // the viewer's own row is pinned under the list, unranked until they score
  const mine = page.locator("#leaderboardMine .lb-row.me");
  await expect(mine.locator(".lb-name")).toHaveText("You");
  await expect(mine.locator(".lb-rank")).toHaveText("–");
});

test("a community world from Firestore is listed and plays", async ({ page, openGame }) => {
  await seedDoc("worlds", world.id, {
    ...world,
    tagline: world.spec.tagline,
    author: { uid: "e2e-author", name: "Tester" },
    createdAt: Date.now(),
  });

  await openGame();
  await page.locator('.mode-card[data-mode="create"]').click();
  const creator = page.locator("#createScreen");
  await expect(creator).toBeVisible();
  await creator.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator("#communityStatus")).toContainText("Live");

  const card = page.locator(".world-card", { hasText: world.name });
  await expect(card).toBeVisible();
  await expect(card).toContainText("by Tester");

  await card.getByRole("button", { name: "Play", exact: true }).click();
  await expect(creator).toBeHidden();
  await expect(page.locator("#loadingScreen")).toBeHidden();
  await expect(page.locator("#pauseBtn")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseScore")).toContainText(world.name);
});
