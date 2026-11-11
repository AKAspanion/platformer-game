# Phase 6, Track B: Mobile and Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the project's workflow policy names the executor (`run.executor`): ga:feature-build-team by default, or ga:feature-build. Follow the policy and this plan's Checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated level has floating platforms again, the next level is ready before the portal, and the touch controls, pause button, Help and menus suit a landscape phone.

**Architecture:** Three independent slices.

- **Task 1** fixes platform placement in the level generator (`app/pcg/generator.js`) and adds a platform rule to `validate`. Story levels keep today's placement through an explicit `placement: "v1"` flag, so the committed `app/areas` files stay byte-identical.
- **Task 2** adds a background preloader (`app/game/preload.js`) and a tile-set cache. Loading the next level's sprites and music never flips the current level back to "loading", and a portal into a ready level draws on its first frame.
- **Task 3** is the shell work in `app/index.html`, `app/index.css` and `app/index.js`: control opacity, pause at the bottom middle, Help for this device only, and compact short-screen layout.

**Tech Stack:** Vanilla JS ES modules bundled by webpack 5 (`app/`), HTML5 Canvas, CSS, localStorage settings (`app/util/settings.js`), tests via `pnpm test` (esbuild + `node --test`, files in `tests/`), ESLint (`pnpm lint`), GitHub Actions CI (`.github/workflows/ci.yml`, which also runs `node scripts/sync-functions-shared.js --check`).

**Spec:** `docs/specs/2026-11-11-phase-6-combat-mobile-rewards.md` (§2, Track B)

## Spec changes this plan relies on

The spec was updated to match the code before the build: §2.5's root cause and first task (the placement is wrong, not the reachability check), story levels kept on today's placement (`placement: "v1"`), §2.3's mode cards staying in one row at 561 px wide and up, and §2.1's pressed opacities for each level.

## Global Constraints

- The branch is `feat/mobile-feel`, cut from `feat/combat` (Track A; the tracks are built one after another). Once Track A merges, rebase onto `master` before opening this PR.
- No new npm dependency, no Firestore rules change, no new Cloud Function.
- The level generator is shared with the server: after any change to `app/pcg/generator.js`, run `pnpm functions:sync` and commit `functions/shared/pcg/generator.js` with it. CI fails on a stale copy (`node scripts/sync-functions-shared.js --check`). The daily score ceiling is computed from the same generator, so the client and the function must ship in the same deploy.
- Story level layouts don't change: `app/areas/*.json` stay byte-identical, and the existing test "generated levels are up to date and pass the reachability check" passes unchanged.
- Every settings read and write goes through `settings.get` / `settings.set` (`app/util/settings.js`), which already survive blocked storage.
- Player-facing copy is the spec's exactly.
- Track A (`docs/plans/2026-11-11-phase-6a-combat.md`) also edits `app/game/enemies.js`, `app/game/boss.js` and `app/game/projectiles.js`. Whichever branch merges second rebases onto the other; Task 2's changes to those files stay limited to the preload hooks named below.

## Checkpoints

None (`run.checkpoints: none`). The run goes through all three tasks and stops before pushing (`git.push: ask`).

## Review Focus

1. **Preloading during play:** a level whose enemies' sprites are still downloading for the _next_ level must never show the loading bar or freeze input mid-level (Task 2 case).
2. **Reaching the portal before the preload finishes,** on a slow connection: the loading bar shows until the missing assets are in, and the level never draws blank sprites (Task 2 case).
3. **Daily runs across the deploy:** today's daily levels change shape when the fixed generator ships, so the server's ceiling must come from the same generator copy (Global Constraints; Task 1 commits the synced copy).
4. **A hybrid touch laptop:** Help follows the same `ontouchstart` check as the touch buttons, so a player who sees touch buttons also sees touch help (Task 3 case).
5. **A phone with a gesture bar or notch:** the bottom-middle pause button and the hint above it stay inside the safe area and never overlap the arrow or action buttons (Task 3 case, checked at 667 × 375 and 844 × 390).

---

### Task 1: Platforms in every generated level

**Files:**

- Modify: `app/pcg/generator.js` (`placePlatforms`, `placeSkyPlatforms`, `buildLevelOnce`, `validate`, `LEVELS`, `buildAll`)
- Modify: `functions/shared/pcg/generator.js` (written by `pnpm functions:sync`)
- Create: `tests/fixtures/sunny-coral-reef.json` (copy of the shared world record, without its `author` field)
- Create: `tests/platforms.test.js`

**Interfaces:**

- Consumes: existing `buildLevel`, `validate`, `generateArea`, `generateSequence`, `generateEndlessLevel`, `buildAll`, `unreachablePlatforms` in `app/pcg/generator.js`. The fixture is built with existing `normalizeWorldSpec` (`app/worlds/spec.js`) and `buildWorld` (`app/gen/index.js`, called with `{ audio: false }`).
- Produces:

```js
// app/pcg/generator.js
export const MIN_PLATFORM_ROWS = 2;   // rows that hold floating platforms
export const MIN_PLATFORM_TILES = 10; // floating platform tiles in all
// A level input may carry `placement: "v1"`: today's placement and today's
// validate (no platform rule). Every story entry in LEVELS carries it.
// Without it (daily, endless, community), platforms are placed so the jump
// model reaches each one from the entry, and validate applies the rule.
export function validate(level: { heights, platforms, traps, data, placement?: "v1", boss?: string }): string | null;
// new error string for the rule: "too few floating platforms (<rows> rows, <tiles> tiles)"
```

**Spec:**

- §2.5: "A generated level other than a boss arena is valid only with at least 2 rows and at least 10 tiles of floating platforms. A level that falls short is retried with the next seed, like any other invalid level."
- §2.5: "Boss arenas keep their fixed ledges."
- §2.5: "Story levels already shipped keep their layouts (best times, stars and ghosts depend on them)."
- §2.5: Test: the Sunny Coral Reef record's 5 non-boss levels each have floating platforms; a sweep over many seeds and every theme finds no generated level under the rule.

**Tags:** `failure-paths`

**Acceptance:**

- Given the Sunny Coral Reef fixture (world `wmwc1eva8px1kub`, seed 889198317), when its six levels are generated with `generateSequence`, then each of levels 1–5 has at least 2 rows and at least 10 tiles of floating platforms. Today level 1 has 0, which makes this the failing test.
- Given Sunny Coral Reef level 1's first-pass layout before the fix (ground at row 9, a platform at row 6), when the cause is confirmed, then the commit message names it: a platform 3 rows (48 px) above the ground is beyond the jump model's 44.4 px highest jump, and the sky tier was linked to it.
- Given the fixed placement, when 300 community-world levels (60 worlds × levels 1–5, built from the fixture's spec with different seeds) and 1,000 endless levels (seeds 1–100 × index 0–9) are generated, then none has fewer than 2 platform rows or 10 platform tiles. Also, `unreachablePlatforms` finds no platform on any first pass.
- Given a sweep of `generateSequence` over every theme (`grasslands`, `iceland`, `desert`, `dungeon`, `lab`, `gen`) at difficulties 1–5, when each non-boss level is checked, then each meets the rule.
- Given a boss level (`boss` set), when it is generated, then it has exactly the three `BOSS_LEDGES` platforms, and `validate` doesn't apply the platform rule to it.
- Given a non-boss level input with no `placement` whose layout has one platform row, when `validate` runs, then it returns `"too few floating platforms (1 rows, 4 tiles)"` for a 4-tile platform, and `generateArea` moves on to the next seed.
- Given a story `LEVELS` entry (`placement: "v1"`), when `buildAll()` runs, then every area equals its committed `app/areas/area-<id>.json` (the existing "up to date" test passes unchanged).
- Given the new generator, when `node scripts/sync-functions-shared.js --check` runs after `pnpm functions:sync`, then it passes.

- [ ] **Step 1: Copy the fixture.** Copy the shared world record into `tests/fixtures/sunny-coral-reef.json`, keeping `id`, `name`, `spec`, `seed` and `version` and dropping `author`. Source: it was saved at `/private/tmp/claude-502/-Users-ankitkumarpandit--claude-spares-spare-spfEHP/17d0c224-a6f8-4e74-b0be-6c3efd31b5a5/scratchpad/reef.json`. If that file is gone, read the public document `worlds/wmwc1eva8px1kub` through Firestore's REST endpoint for project `dinos-adventure` (reads are public).

- [ ] **Step 2: Write the failing tests** for each Acceptance case, in `tests/platforms.test.js`.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL on the Sunny Coral Reef level 1 case (0 platform tiles), the sweep counts and the `validate` rule message. A "not defined" failure proves nothing: export `MIN_PLATFORM_ROWS` and `MIN_PLATFORM_TILES` first, so the tests fail on behaviour.

- [ ] **Step 4: Confirm the cause.** Debug first: on level 1's first pass, print each platform's rise from the surfaces it could be jumped to from, and check it against the jump model (`jumpReach`, `canJump`). Fix nothing until the cause is confirmed.

- [ ] **Step 5: Write the minimal implementation** to the Interfaces.
  - Flat-segment platforms sit only at rows the jump model reaches from the segment's ground.
  - `placeSkyPlatforms` links a new platform only to surfaces reachable from the entry.
  - `validate` applies the platform rule to non-boss levels without `placement: "v1"`.
  - Every story entry in `LEVELS` gets `placement: "v1"`, and placement v1 behaves exactly as today.

- [ ] **Step 6: Sync the server copy**

Run: `pnpm functions:sync`
Expected: `functions/shared/pcg/generator.js` updated

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, including the unchanged "generated levels are up to date and pass the reachability check"

- [ ] **Step 8: Commit**

```bash
git add app/pcg/generator.js functions/shared/pcg/generator.js tests/platforms.test.js tests/fixtures/sunny-coral-reef.json
git commit -m "fix(levels): every generated level keeps reachable floating platforms"
```

---

### Task 2: The next level is ready

**Files:**

- Create: `app/game/preload.js`
- Modify: `app/game/world.js` (start the preload once the level has loaded; `assetsFor` stays the list of what an area needs)
- Modify: `app/game/enemies.js` (`loadEnemyKind`: reuse an image the preloader already has, counting only images not yet in)
- Modify: `app/game/boss.js` (the boss sprite loader: same reuse)
- Modify: `app/game/projectiles.js` (`loadFrames`: same reuse)
- Modify: `app/controller/audio.js` (`load`: a track the preloader already has counts as in)
- Modify: `app/screen/tileset.js` (one cached tile set per world, so a portal within a world reuses a loaded set)
- Modify: `app/screen/index.js` (take the tile set from the cache)
- Test: `tests/preload.test.js`

**Interfaces:**

- Consumes: existing `World.assetsFor(area)` → `{ images: string[], audio: string[] }` (`app/game/world.js`); existing `areas` registry (`app/areas/index.js`, which modes add to at runtime, so endless's next level is already there); existing loaders `loadEnemyKind`, `bossImages`, `SEED_IMAGES`, `AudioController.load`.
- Produces:

```js
// app/game/preload.js
/** True when the browser asks to save data; then nothing preloads. */
export function saveDataOn(): boolean; // navigator.connection?.saveData === true
/**
 * Starts downloading an area's sprites, tile set and music in the background.
 * Never changes any loader's counts, so the current level stays loaded.
 * Returns null when save-data is on or the area is missing.
 */
export function preloadArea(area: object | undefined): { done(): boolean } | null;
/** The image for `src`: the preloaded one if it exists (loaded or in flight), else null. */
export function preloaded(src: string): HTMLImageElement | null;
export function preloadedAudio(src: string): boolean; // true once that track is fully in

// app/screen/tileset.js
/** The tile set for a world (or a generated skin), made once and reused. */
export function tileSetFor(tileSize: number, columns: number, world: number, skin?: object | null): TileSet;
```

**Spec:**

- §2.4: "Once a level has loaded, the next level's sprites and music start downloading in the background."
- §2.4: "Going through the portal shows no loading bar when the next level is already in; otherwise the bar shows as it does today."
- §2.4: "When the browser asks to save data (`navigator.connection.saveData`), nothing preloads."
- §2.4: Endless already builds one level ahead; its next level's assets preload the same way. A community world's art is generated in memory and needs no download; its music tracks preload.

**Tags:** `failure-paths`

**Acceptance:**

- Given a story level whose forward portal leads to a level with a new enemy kind and a boss track, when the current level reports loaded, then the next level's enemy sprites, boss sprites and music are requested once each. Requests are recorded through `globalThis.__requested`, as `tests/lazy-assets.test.js` does.
- Given that preload is in flight, when the current level updates, then `game.isLoaded()` stays `true` on every tick: no loading bar mid-level.
- Given the preload has finished, when the player goes through the portal and the next level is set up, then `game.isLoaded()` and the screen's `isLoaded()` are `true` on the first update after setup.
- Given the preload has _not_ finished (an image still in flight), when the next level is set up, then `game.isLoaded()` is `false` until that image's load event fires, and each image is requested once, not twice.
- Given a preloaded image that fails (error event), when the next level is set up, then it counts as in (like today's `onerror` handling) and the level starts.
- Given `navigator.connection.saveData === true`, when a level loads, then `preloadArea` returns `null` and nothing is requested before the portal.
- Given an endless run, when level N has loaded, then level N+1 (already in `areas`) is preloaded.
- Given a community-world level (generated `skin`), when it loads, then only its music is preloaded and no tile or sprite file is requested.
- Given two portals in a row within the same world, when the second level is set up, then `tileSetFor` returns the same tile set, which is already loaded.
- Given a level with no forward portal (the last boss, `FINISH`), when it loads, then nothing is preloaded.

- [ ] **Step 1: Write the failing tests** for each Acceptance case, in `tests/preload.test.js`, reusing the request recording and fake `Image` from `tests/env.js`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL on the assertions. Create `app/game/preload.js` and `tileSetFor` with their real signatures first, so the tests fail on behaviour, not on "module not found".

- [ ] **Step 3: Write the minimal implementation** to the Interfaces. The preloader keeps its own map of `src` to image or track; the existing loaders take an image from that map and add it to their counts only while it is still in flight.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, including the existing `tests/lazy-assets.test.js` (the home screen still requests no level assets)

- [ ] **Step 5: Check it in the browser.** Start the preview `game` (`.claude/launch.json`, port 2108). Walk Grassland 1 → 2 → 3 at 844 × 390, and confirm no loading bar shows at either portal. Then set the browser network panel to Slow 4G, reach the portal at once, and confirm the bar shows and the level starts.

- [ ] **Step 6: Commit**

```bash
git add app/game/preload.js app/game/world.js app/game/enemies.js app/game/boss.js app/game/projectiles.js app/controller/audio.js app/screen/tileset.js app/screen/index.js tests/preload.test.js
git commit -m "feat(levels): preload the next level so portals skip the loading bar"
```

---

### Task 3: Controls, pause, Help and compact menus

**Files:**

- Create: `app/controller/opacity.js`
- Modify: `app/util/settings.js` (default `controlOpacity: "medium"`)
- Modify: `app/util/index.js` (`populateHelp(touch)` and a pure `helpItemsFor(touch)`)
- Modify: `app/index.html` (Settings: a "Control opacity" segmented row beside "Touch buttons")
- Modify: `app/index.css` (control opacity variables, pause at the bottom middle, hint above it, short-screen sizes)
- Modify: `app/index.js` (apply opacity, wire the Settings row, pass `isTouchesEnabled` to `populateHelp`)
- Test: `tests/controls.test.js`

**Interfaces:**

- Consumes: existing `settings.get` / `settings.set` (`app/util/settings.js`); existing `isTouchesEnabled` (`app/index.js`); existing `--ctrl`, `--sab`, `--sal`, `--sar` CSS variables and the `.segmented` Settings control.
- Produces:

```js
// app/controller/opacity.js
export const CONTROL_OPACITY = {
  low:    { idle: 0.25, pressed: 0.55 },
  medium: { idle: 0.45, pressed: 0.75 },
  high:   { idle: 0.7,  pressed: 1 },
};
/** Opacity for a setting value; anything unknown is "medium". */
export function controlOpacity(value: string): { idle: number, pressed: number };

// app/util/index.js
/** The Help sections to show: [{ name, content }]; touch → only "Mobile", else only "Desktop". */
export function helpItemsFor(touch: boolean): Array<{ name: string, content: object[] }>;
export const populateHelp: (touch?: boolean) => void; // default false
```

CSS variables set on `document.documentElement` by `app/index.js`: `--ctrl-idle`, `--ctrl-pressed` (numbers from `controlOpacity`).

**Spec:**

- §2.1: "Touch buttons are drawn at 45% opacity, and 75% while pressed."
- §2.1: "Settings has "Control opacity": Low (25%, 55% pressed), Medium (45%, 75% pressed) or High (70%, 100% pressed). Medium is the default."
- §2.1: "The pause button sits at the bottom middle of the screen on every device, inside the safe area (notches and gesture bars), the same size as the other touch buttons."
- §2.1: "The first-open hint shows above the pause button, never under it."
- §2.2: "On a touch device (the same check that shows the touch buttons, `"ontouchstart" in document.documentElement`), Help shows only the touch controls. Everywhere else it shows only the keyboard controls."
- §2.3: "Tap targets stay at least 44 px tall."
- §2.3: Done means: "At 667 × 375 and 844 × 390, everything on the home screen fits without scrolling." Before-and-after screenshots at both sizes go in the PR.
- §2.3: Screens taller than 500 px look as they do today.

**Tags:** `screen`

**Acceptance:**

- Given no saved setting, when `controlOpacity(settings.get("controlOpacity"))` is read, then it is `{ idle: 0.45, pressed: 0.75 }`.
- Given `"low"`, `"medium"` and `"high"`, when `controlOpacity` runs, then it returns `0.25 / 0.55`, `0.45 / 0.75` and `0.7 / 1`. Given `"loud"` or `undefined`, then it returns the medium pair.
- Given `helpItemsFor(true)`, then it returns exactly one section, named "Mobile". Given `helpItemsFor(false)`, then it returns exactly one section, named "Desktop". The Tips section shows either way.
- Given `populateHelp()` with no argument (as `tests/lazy-assets.test.js` calls it), then it builds the Desktop section and the tips, and the help-icon test still passes.
- In the browser at 667 × 375 and 844 × 390 (touch emulated), and at 390 and 1280 wide:
  - The touch buttons show at 45% opacity and 75% while held.
  - Settings shows a "Control opacity" row with Low / Medium / High, with Medium active. Choosing Low makes the buttons visibly fainter at once, and the choice survives a reload.
  - The pause button sits at the bottom middle, the same size as the arrow buttons, above the gesture bar, and overlaps neither arrow nor action buttons. On desktop (1280, no touch) it is at the bottom middle too.
  - On a first open, the controls hint shows above the pause button, never under it.
  - Help on the touch-emulated phone shows only "Mobile". On desktop it shows only "Desktop".
  - At 667 × 375 and 844 × 390, the home screen shows the logo, Play, all four mode cards, the wallet row (coins, Shop, Achievements) and the footer icons without scrolling. Every button and card is at least 44 px tall.
  - At 1280 × 800 the home screen looks as it does on `master`.
  - Settings, Help, the level select and the pause and result panels open at 667 × 375 without content cut off.

- [ ] **Step 1: Write the failing tests** for the `controlOpacity` and `helpItemsFor` cases, in `tests/controls.test.js`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL on the assertions. Create `app/controller/opacity.js` and export `helpItemsFor` with their real signatures first, so the tests fail on behaviour.

- [ ] **Step 3: Write the minimal implementation** of `controlOpacity`, `helpItemsFor`, `populateHelp(touch)` and the `controlOpacity` default.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, including `tests/lazy-assets.test.js`

- [ ] **Step 5: Take the "before" screenshots.** Start the preview `game` (port 2108) on `master`, and screenshot the home screen at 667 × 375 and 844 × 390 for the PR.

- [ ] **Step 6: Build the screen changes:** the Settings row and its wiring, opacity variables on `.controller-btn`, `.persistent-controller` at the bottom middle sized `var(--ctrl)` inside `--sab`, `.hint` raised above it, and an `@media (max-height: 499px)` block shrinking home and menu buttons, gaps, padding and type by about 25%.

- [ ] **Step 7: Check every browser case** in the Acceptance list, at 667 × 375, 844 × 390, 390 wide and 1280 wide, and take the "after" screenshots at 667 × 375 and 844 × 390 for the PR.

- [ ] **Step 8: Run the checks**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add app/controller/opacity.js app/util/settings.js app/util/index.js app/index.html app/index.css app/index.js tests/controls.test.js
git commit -m "feat(ui): see-through controls, pause at the bottom, device-only Help, compact menus"
```
