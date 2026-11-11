# Phase 5: Ghost Runs and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the project's workflow policy names the executor (`run.executor`): ga:feature-build-team by default, or ga:feature-build. Follow the policy and this plan's Checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Race a see-through ghost of your fastest run on every campaign level, start brand-new players straight in Grassland 1 with a controls hint, and offer community worlds once after world 1.

**Architecture:** Two pure modules carry the rules: `app/ghosts/ghost.js` records the dino 15 times a second, packs a run into a compact string, keeps one ghost per level in local storage and answers where the ghost is at any tick; `app/onboarding/onboarding.js` decides first open, when the controls hint is done, and whether the world 1 card may show. One task wires both into the game loop, the renderer, Settings and the screens.

**Tech Stack:** Vanilla JS ES modules bundled by webpack 5 (`app/`), HTML5 Canvas, localStorage, tests via `pnpm test` (esbuild + `node --test`), ESLint 10, GitHub Actions CI (`.github/workflows/ci.yml`).

**Spec:** `docs/specs/2026-11-11-phase-5-polish.md`

## Global Constraints

- The branch is `feat/polish`, cut from `feat/reminders` (PR #10). Once PR #10 merges, rebase onto `master` before opening this PR.
- No new npm dependency; no server or Firestore change.
- "Ghosts are kept on this device only and are not part of cloud save."
- "The ghost never collides, collects, hurts or changes anything; it is only drawn."
- Every storage read and write survives blocked or full storage: reads fall back to nothing, writes fail silently, and the game plays on.
- Player-facing copy is the spec's exactly.

## Checkpoints

None (`run.checkpoints: none`). The run goes through all three tasks and stops before pushing (`git.push: ask`).

## Review Focus

1. Local storage full when a ghost is saved: the finish, its stars and its best time still count, and only the ghost is skipped (Task 1 case).
2. A kept ghost written by an older or broken build (corrupt string): it's ignored and replaced by the next finish, never a crash (Task 1 case).
3. A finish slower than the kept ghost: the kept ghost stays (Task 1 case).
4. A returning player whose progress came from cloud save on a new device: never sent through the first-open flow (Task 2 case).
5. The controls hint on a touch screen: the touch copy shows, not the keyboard copy (Task 3 case).

---

### Task 1: Ghost recording, storage and playback

**Files:**

- Create: `app/ghosts/ghost.js`
- Test: `tests/ghosts.test.js`

**Interfaces:**

- Consumes: existing `LEVELS` from `app/util/index.js`; the player's animation names from `app/game/player.js` (`frameSets` keys such as `idleRight`, `runLeft`, `riseRight`, `fallLeft`, `hurtRight`).
- Produces (used by Task 3):

```js
// app/ghosts/ghost.js
export const SAMPLE_EVERY = 2;        // ticks (30 per second): 15 samples a second
export const MAX_SECONDS = 240;       // a longer run keeps no ghost
export const GHOST_ALPHA = 0.35;
export const ANIMS: string[];         // every player frameSet name, in a fixed order
export type Sample = { x: number, y: number, anim: string, frame: number };
export type Ghost = { levelId: number, seconds: number, samples: Sample[] };
/** Collects samples during one attempt at a level. */
export function createRecorder(): {
  sample(tick: number, player: { x: number, y: number, anim: string, frame: number }): void, // keeps every SAMPLE_EVERY-th tick
  finish(levelId: number, seconds: number): Ghost | null, // null when seconds > MAX_SECONDS or nothing was sampled
  reset(): void,
};
export function encodeGhost(ghost: Ghost): string;
export function decodeGhost(text: string): Ghost | null;  // null for anything malformed
/** One ghost per campaign level, in localStorage keys "ghost_<levelId>". */
export function createGhostStore(storage?: Storage): {
  get(levelId: number): Ghost | null,
  /** Saves when there is none yet or `ghost.seconds` is lower than the kept one; returns whether it saved. */
  offer(ghost: Ghost): boolean,
  clearAll(): void,
};
/** Where the ghost is at `tick` of the level's clock (interpolating position between samples), or null once its run has ended. */
export function ghostAt(ghost: Ghost, tick: number): Sample | null;
```

**Spec:**

- §1: "A finish saves a new ghost only when it is the level's first finish on this device, or faster than the ghost already kept."
- §1: "The ghost starts when the level starts and moves exactly as the kept run did, by the level's clock. When the kept run reached the exit, the ghost disappears."
- §1: "A ghost records the dino's position 15 times a second. A run longer than 4 minutes keeps no ghost."
- §1: "Ghosts are kept on this device only and are not part of cloud save."
- §1: "Reset progress also erases every ghost."

**Tags:** `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given a recorder fed ticks 0–9, when `finish(1, 0.33)` runs, then the ghost has 5 samples (ticks 0, 2, 4, 6, 8).
- Given a run of 240 seconds, then `finish` keeps it; 241 seconds, then null; nothing sampled, then null.
- Given a ghost, when `encodeGhost` then `decodeGhost` run, then positions match to within 1 pixel, and `anim`, `frame`, `levelId` and `seconds` match exactly.
- Given a 120-second ghost, when encoded, then the string is under 20,000 characters.
- Given "", "not a ghost", a truncated string or one with an unknown `anim`, when `decodeGhost` runs, then null and nothing throws.
- Given an empty store, when `offer` gets a 40-second ghost for level 1, then true and `get(1)` returns it; offering 45 seconds, then false and the 40-second one stays; offering 38 seconds, then true and it replaces it.
- Given a store whose `get` finds a corrupt value, then it returns null, and the next `offer` saves over it.
- Given storage whose `setItem` throws (full), when `offer` runs, then it returns false and nothing throws.
- Given ghosts for levels 1 and 7 and another key "campaign", when `clearAll` runs, then both ghosts are gone and "campaign" stays.
- Given a ghost sampled at ticks 0 (x 10) and 2 (x 14), when `ghostAt(ghost, 1)` runs, then x is 12 and anim and frame are tick 0's; at a tick past the last sample, then null.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/ghosts.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test ghosts`
Expected: FAIL on the assertions, with `ghost.js` exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/ghosts/ghost.js tests/ghosts.test.js
git commit -m "feat(ghosts): record, store and replay a level's fastest run"
```

---

### Task 2: Onboarding rules

**Files:**

- Create: `app/onboarding/onboarding.js`
- Test: `tests/onboarding.test.js`

**Interfaces:**

- Consumes: existing campaign state shape `{ reached, last, stars, best }` (`app/campaign/index.js`), existing `LEVELS`.
- Produces (used by Task 3):

```js
// app/onboarding/onboarding.js — flags in localStorage key "onboarding": { firstOpenDone, hintDone, world1OfferShown }
export const HINT_TIMEOUT = 15000; // ms
export const HINT_KEYBOARD = "← → move · ↑ or Space jump · Enter fire";
export const HINT_TOUCH = "Use the buttons to move, jump and fire";
export function createOnboarding(storage?: Storage): {
  /** True once ever, for a device with no campaign progress; marks it done. */
  takeFirstOpen(campaign: { reached: number[], stars: Record<number, number> }): boolean,
  hintText(touch: boolean): string,
  /** A hint run: report moves, jumps and time; returns the reason once it is done. */
  startHint(now: number): {
    moved(): void, jumped(): void,
    tick(now: number): null | { reason: "played" | "timeout", seconds: number },
  },
  hintDone(): void,
  /** True the first time Grassland 6 is beaten (levelId 25), and never again; marks it shown. */
  takeWorld1Offer(levelId: number): boolean,
};
```

**Spec:**

- §2: "The very first time the game opens on a device with no campaign progress (nothing reached beyond Grassland 1 and no stars), it skips the home screen once and starts Grassland 1 as soon as loading finishes."
- §2: "During that first run, a controls hint shows at the top of the screen: on a keyboard "← → move · ↑ or Space jump · Enter fire", on a touch screen "Use the buttons to move, jump and fire"."
- §2: "The hint fades out once the player has moved and jumped, or after 15 seconds, whichever comes first, and never shows again."
- §2: "Every later open shows the home screen, as today."
- §3: "The first time a player beats Grassland 6 (the world 1 boss), a card appears once: title "You beat World 1!", text "Play worlds made by other players, or make your own.", with buttons "Play community worlds", "Make my own" and "Later"."
- §3: "The card never shows again, whichever button is pressed."

**Tags:** `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given campaign {reached [1], stars {}} and a fresh store, when `takeFirstOpen` runs, then true; the second call, false; after a reload with the same storage, false.
- Given campaign {reached [1, 2], stars {}} or {reached [1], stars {1: 1}} (progress, for example pulled from cloud save), then false, and it stays false later.
- Given `hintText(false)`, then "← → move · ↑ or Space jump · Enter fire"; `hintText(true)`, then "Use the buttons to move, jump and fire".
- Given a hint started at 0, when moved at 2000 and jumped at 4000, then `tick(4000)` returns {reason "played", seconds 4}; given only moves, then `tick(15000)` returns {reason "timeout", seconds 15}; before either, `tick` returns null.
- Given levelId 25 for the first time, when `takeWorld1Offer` runs, then true; again, false; for levelId 27, false.
- Given blocked storage (getItem throws), when `takeFirstOpen` runs with no progress, then it returns false (never risks repeating the first-open flow) and nothing throws; `takeWorld1Offer(25)` returns false.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/onboarding.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test onboarding`
Expected: FAIL on the assertions, with `onboarding.js` exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/onboarding.js tests/onboarding.test.js
git commit -m "feat(onboarding): first open, controls hint and world 1 offer rules"
```

---

### Task 3: Ghosts and onboarding in the game

**Files:**

- Modify: `app/index.js`
- Modify: `app/index.html`
- Modify: `app/index.css`
- Modify: `app/util/settings.js` (default `ghost: true`)
- Test: `tests/ghost-settings.test.js`

**Interfaces:**

- Consumes: `createRecorder`, `createGhostStore`, `ghostAt`, `GHOST_ALPHA` (Task 1); `createOnboarding`, `HINT_TIMEOUT` (Task 2); existing `finishLevel`, `setupWorld`, `update`, `render`, `drawPlayer`, `isCampaignLevel`, `startStory`, the loading screen hand-off in `update`, the Reset progress handler, `selectTab`/`openCreator`, `settings`, `track`.
- Produces: the screens below; `settings.get("ghost")` defaults to true.

Screens and states:

| Screen                                | State                       | Shows                                                                                                                             |
| ------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Campaign level                        | ghost kept, Show ghost on   | the classic dino at 35% opacity behind the player, replaying the kept run                                                         |
| Campaign level                        | no ghost, or Show ghost off | no ghost                                                                                                                          |
| Other modes                           | any                         | no ghost                                                                                                                          |
| First open                            | after loading               | Grassland 1 starts with no home screen; hint at the top in keyboard or touch copy                                                 |
| First open                            | moved and jumped, or 15 s   | hint fades out                                                                                                                    |
| After beating Grassland 6, first time | —                           | card "You beat World 1!", "Play worlds made by other players, or make your own.", "Play community worlds", "Make my own", "Later" |
| Settings                              | —                           | switch "Show ghost", on by default                                                                                                |

**Spec:**

- §1: "Each campaign level keeps a ghost of the player's fastest finish on this device: a see-through copy of the dino replaying that run."
- §1: "The ghost is drawn at 35% opacity, behind the player, in the classic look (no skin, no hat), facing and animating as the run did."
- §1: "After a death or a restart, the ghost follows the level's clock, so it restarts with the level."
- §1: "Ghosts exist only on campaign levels, boss levels included; not in the daily challenge, endless, community worlds, Starfall Peaks or boss rush."
- §1: "Settings has a switch "Show ghost", on by default. Off hides ghosts but still keeps new ones."
- §1: "Reset progress also erases every ghost."
- §2: "Target: Grassland 1 is playable within 10 seconds of opening the page on a typical connection."
- §3: ""Play community worlds" opens the Community tab (free). "Make my own" opens Create, which asks for premium as it does today. "Later" closes the card."
- §4: `ghost_saved` `{ level_id, seconds }`

**Tags:** `screen`, `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given a fresh settings store, when `settings.get("ghost")` runs, then true; after `settings.set("ghost", false)`, false.
- Given Grassland 1 finished in 38 s with no ghost kept, when the level ends, then a ghost is saved and `ghost_saved {level_id: 1, seconds: 38}` is tracked; replaying it, the ghost moves along the kept path at 35% opacity behind the dino, in the classic look even with a skin and hat worn.
- Given a slower finish, then the kept ghost stays and nothing is tracked.
- Given a death mid-level, when the level restarts, then the ghost restarts with the level's clock.
- Given Show ghost off, then no ghost is drawn, and a faster finish still saves a new one.
- Given the daily challenge, endless, a community world, Starfall Peaks or boss rush, then no ghost is recorded or drawn.
- Given Reset progress, when it completes, then no ghost is kept.
- Given a device with no progress, when the game opens, then Grassland 1 starts right after loading without the home screen, `onboarding_start` is tracked, and the hint shows in keyboard copy on a desktop and touch copy on a touch screen; the next open shows the home screen.
- Given the hint showing, when the player moves and jumps, then it fades and `onboarding_hint_done {reason: "played"}` is tracked with its seconds; with no jump for 15 s, `{reason: "timeout", seconds: 15}`.
- Given Grassland 6 beaten for the first time, when the level ends, then the world 1 card shows; "Play community worlds" opens Community, "Make my own" opens Create (premium dialog without premium), "Later" closes it, each tracks `world1_offer {choice}`, and beating it again shows nothing.
- Given widths 1280 and 844x390, when the hint, the world 1 card and Settings show, then nothing overflows and every button is reachable.

- [ ] **Step 1: Write the failing tests** for the settings case in `tests/ghost-settings.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test ghost-settings`
Expected: FAIL on the assertion

- [ ] **Step 3: Write the minimal implementation**: the settings default, then recording, saving, drawing, the first-open flow, the hint, the world 1 card and the Settings switch in `app/index.js`, `app/index.html` and `app/index.css`

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Check every screen state in the browser**

Run the dev server, open the game with `?debug`, and walk each Acceptance case for the screens at 1280 and 844x390: a ghost after a finish and on replay, the Show ghost switch, a mode without ghosts, first open (clear localStorage first), the hint in both copies, and the world 1 card's three buttons. Time the first open from page load to Grassland 1 being playable. Take a screenshot of each.
Expected: every state matches the table above; the console shows no errors

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/index.js app/index.html app/index.css app/util/settings.js tests/ghost-settings.test.js
git commit -m "feat(polish): ghost runs, first-open onboarding and the world 1 offer"
```
