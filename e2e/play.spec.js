/**
 * The game itself, no account needed: a first open, the keyboard driving the
 * dino, pause, home and Play again, and the pages Hosting serves beside it.
 */
const { test, expect } = require("./fixtures");

test("a first open plays Grassland 1, pauses and goes home", async ({ page, openGame }) => {
  await openGame({ fresh: true });

  // a new player skips the home screen: the level loads with the controls hint
  const hint = page.locator("#hint");
  await expect(hint).toHaveClass(/\bshow\b/);
  await expect(hint).toContainText("move");
  await expect(page.locator("#loadingScreen")).toBeHidden();
  await expect(page.locator("#homeScreen")).toBeHidden();
  await expect(page.locator("#pauseBtn")).toBeVisible();

  // moving and jumping clears the hint, so the keys reached the dino. Left alone it
  // clears after 15 s (HINT_TIMEOUT), so it must go well before that.
  await page.keyboard.down("ArrowRight");
  await expect(async () => {
    await page.keyboard.press("ArrowUp", { delay: 120 }); // jumps once the dino is on the ground
    await expect(hint).not.toHaveClass(/\bshow\b/, { timeout: 400 });
  }).toPass({ timeout: 6_000 });
  await page.keyboard.up("ArrowRight");

  // Escape pauses on the level that is playing
  await page.keyboard.press("Escape");
  const pauseScreen = page.locator("#pauseScreen");
  await expect(pauseScreen).toBeVisible();
  await expect(page.locator("#pauseTitle")).toHaveText("Paused");
  await expect(page.locator("#pauseScore")).toContainText("Grassland 1");

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(pauseScreen).toBeHidden();
  await expect(page.locator("#pauseBtn")).toBeVisible();

  // the on-screen pause button, then Home
  await page.locator("#pauseBtn").click();
  await page.getByRole("button", { name: "Home" }).click();
  const home = page.locator("#homeScreen");
  await expect(home).toBeVisible();
  await expect(page.locator("#pauseBtn")).toBeHidden();

  // Play continues the campaign
  await home.getByRole("button", { name: "Play", exact: true }).click();
  await expect(home).toBeHidden();
  await expect(page.locator("#loadingScreen")).toBeHidden();
  await expect(page.locator("#pauseBtn")).toBeVisible();
});

test("a returning player starts on the home screen", async ({ page, openGame }) => {
  await openGame();
  const home = page.locator("#homeScreen");
  await expect(home).toBeVisible();
  await expect(home.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(home.locator(".mode-card")).toHaveCount(4);

  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.locator("#helpScreen")).toBeVisible();
  await page.locator("#helpCloseBtn").click();
  await expect(page.locator("#helpScreen")).toBeHidden();
});

test("the legal pages and the account email page are served", async ({ page }) => {
  for (const [path, heading] of [
    ["/privacy", /privacy/i],
    ["/terms", /terms/i],
  ]) {
    const response = await page.goto(path);
    expect(response.status(), path).toBe(200);
    await expect(page.locator("h1").first()).toContainText(heading);
  }
  const response = await page.goto("/auth/action");
  expect(response.status()).toBe(200);
});
