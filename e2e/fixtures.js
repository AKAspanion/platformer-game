/**
 * The test object every spec uses: Playwright's, plus
 *   - a check that the page threw no uncaught error during the test
 *   - openGame({ fresh }): the game on the emulators, either as a first-time
 *     player (fresh: straight into Grassland 1) or a returning one (the home screen)
 */
const base = require("@playwright/test");

const test = base.test.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      base.expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],

  openGame: async ({ page }, use) => {
    await use(async ({ fresh = false } = {}) => {
      if (!fresh) {
        // the onboarding flags a returning player has (app/onboarding/onboarding.js)
        await page.addInitScript(() => {
          if (!localStorage.getItem("onboarding")) {
            localStorage.setItem(
              "onboarding",
              JSON.stringify({ firstOpenDone: true, hintDone: true }),
            );
          }
        });
      }
      // ?emulators=1: Firebase talks to the emulators through the game's own origin
      await page.goto("/?emulators=1");
    });
  },
});

module.exports = { test, expect: base.expect };
