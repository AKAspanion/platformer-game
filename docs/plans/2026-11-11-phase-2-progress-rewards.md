# Phase 2: Progress and Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the project's workflow policy names the executor (`run.executor`): ga:feature-build-team by default, or ga:feature-build. Follow the policy and this plan's Checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save progress to the player's account, turn collected coins into a wallet with a cosmetics shop, open a secret world at 75 stars and boss rush after all five bosses, and add 12 achievements.

**Architecture:** One pure progress model (`app/progress/`) describes everything worth saving as a single `Progress` snapshot, reads and writes it from the device's existing storage keys, and merges two snapshots without losing anything (per-device counters for coins and kills). A cloud-save engine syncs that snapshot to `saves/{uid}` in Firestore. Cosmetics, the secret world, boss rush and achievements are each their own modules; one last task wires them all into the screens.

**Tech Stack:** Vanilla JS ES modules bundled by webpack 5 (`app/`), HTML5 Canvas, Firebase Web SDK 13 (Auth, Firestore), Cloud Functions v2 on Node 24 with firebase-admin 14 (`functions/`), Python 3 sprite scripts (`scripts/generate-sprites.py`), tests via `pnpm test` (esbuild + `node --test`), ESLint 10, GitHub Actions CI (`.github/workflows/ci.yml`).

**Spec:** `docs/specs/2026-11-11-phase-2-progress-rewards.md`

## Global Constraints

- The branch is `feat/progress-rewards`, cut from `feat/daily-loop` (PR #7, phase 1). Once PR #7 merges, rebase onto `master` before opening this PR.
- No new npm dependency.
- Firebase stays lazy: nothing loads `app/firebase/*` or `firebase/*` before the player's first input or the first use of a Firebase feature.
- Existing storage keys keep their names and shapes (`campaign`, `mode_records`, `high_score`, `daily_streak`), so current players keep their progress. New keys: `wallet`, `achievements`, `stats`, `device_id`.
- Every storage read and write survives blocked or full storage: reads fall back to empty, writes fail silently.
- "Cosmetics change looks only: no item changes speed, jumps, hearts, damage or score."
- Player-facing copy is the spec's exactly.

## Checkpoints

None (`run.checkpoints: none`). The run goes through all five tasks and stops before pushing (`git.push: ask`).

## Review Focus

1. Two devices earn coins offline, then both sync: the account keeps both devices' coins (Task 1 case).
2. An anonymous player signs in to an existing account: this device's progress merges into it and nothing is lost on either side (Task 2 case).
3. Purchases on two devices merge into a negative balance: it shows 0, items stay owned, and the next coins pay the debt first (Task 1 case).
4. A save over 100 KB: it isn't sent, nothing throws, and play goes on (Task 2 case).
5. Boss rush hearts: one comes back after each boss but never above 3, and a death ends the run (Task 4 case).

---

### Task 1: Progress model, wallet, catalogue and unlock rules

**Files:**
- Create: `app/progress/save.js`
- Create: `app/progress/wallet.js`
- Create: `app/progress/stats.js`
- Create: `app/progress/unlocks.js`
- Create: `app/shop/catalog.js`
- Test: `tests/progress-save.test.js`
- Test: `tests/progress-wallet.test.js`
- Test: `tests/progress-unlocks.test.js`

**Interfaces:**
- Consumes: existing `LEVELS` from `app/util/index.js`; existing `starCount`, `STAR` from `app/campaign/index.js`; existing `getData`/`setData` from `app/util/index.js`.
- Produces (used by Tasks 2, 3, 4 and 5):

```js
// app/progress/save.js
export const SAVE_VERSION = 1;
export const MAX_SAVE_BYTES = 102400;
/** Everything cloud save carries. */
export type Progress = {
  v: 1, updatedAt: number,
  campaign: { reached: number[], last: number, stars: Record<number, number>, best: Record<number, number> },
  records: Record<string, { score: number }>,
  highScore: number,
  streak: { days: number, best: number, freezes: number, last: number } | null,
  wallet: { earned: Record<string, number>, rewards: Record<string, number>, owned: string[], worn: { skin: string, hat: string, fireball: string }, wornAt: number },
  achievements: Record<string, number>, // id -> unlocked at (ms)
  stats: { kills: Record<string, number>, flawlessBoss: boolean, secretBoss: boolean, worldsFinished: string[], bossRushBest: number | null },
};
export function emptyProgress(): Progress;
export function readLocal(storage?: Storage): Progress;
export function writeLocal(progress: Progress, storage?: Storage): void;
export function mergeProgress(a: Progress, b: Progress): Progress;
export function saveBytes(progress: Progress): number;
export function deviceId(storage?: Storage): string; // random, kept in "device_id"

// app/progress/wallet.js
export function createWallet(storage?: Storage, device?: string): {
  balance(): number,                 // never below 0
  earned(): number,                  // all devices, lifetime
  earn(coins: number): void,
  reward(achievementId: string, coins: number): boolean, // false if already rewarded
  owns(slot: Slot, id: string): boolean,
  buy(slot: Slot, id: string): { ok: true } | { ok: false, need: number },
  wear(slot: Slot, id: string): boolean, // false unless owned
  worn(): { skin: string, hat: string, fireball: string },
};

// app/progress/stats.js
export function createStats(storage?: Storage, device?: string): {
  addKills(n: number): void, kills(): number,
  markFlawlessBoss(): void, markSecretBoss(): void,
  finishWorld(worldId: string): void,
  bossRushTime(seconds: number): number, // returns the best
  read(): Progress["stats"],
};

// app/progress/unlocks.js
export const SECRET_STARS = 75;
export function campaignStars(campaign: Progress["campaign"], levels?: typeof LEVELS): number;
export function secretWorldOpen(campaign, levels?): boolean;
export function bossesBeaten(campaign, levels?): number; // boss levels with a best time
export function bossRushOpen(campaign, levels?): boolean; // all 5

// app/shop/catalog.js
export type Slot = "skin" | "hat" | "fireball";
export const CATALOG: Record<Slot, Array<{ id: string, name: string, price: number }>>;
export const FREE: { skin: "classic", hat: "none", fireball: "classic" };
export function itemOf(slot: Slot, id: string): { id, name, price } | null;
```

The catalogue's ids, names and prices are exactly the table in spec §2.

**Spec:**
- §1: "Progress is merged, never overwritten: levels reached are the union, stars per level are combined, the best time per level is the lower, each record and the high score are the higher, achievements are the union with the earliest date, owned cosmetics are the union, coins and lifetime stats are counted per device and summed, the streak with the later day wins (on the same day, the longer one), and worn cosmetics come from the save changed last."
- §2: "Each device counts the coins it earned under its own random device ID, so two devices never overwrite each other's coins."
- §2: "The balance is coins earned, plus achievement rewards, minus the prices of the items owned."
- §2: "If purchases made on two devices merge into a balance below 0, the balance shows 0, every item stays owned, and new coins pay off the difference first."
- §2: "The free item of each slot is owned from the start and worn by default."
- §2: "Buying needs a balance at least the item's price. Otherwise the Buy button reads "Need N more" and does nothing."
- §3: "Collecting 75 of the campaign's 90 stars opens a secret sixth world, Starfall Peaks."
- §4: "Beating all five campaign bosses opens Boss Rush: the five boss arenas, in campaign order, back to back."
- §4: "A boss counts as beaten once its level has been finished."
- §5: "Each achievement unlocks once and pays its coins once."

**Tags:** `failure-paths`, `not security: "secret" is the Starfall Peaks world's name; the task touches no credentials, accounts or permissions`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**
- Given a device with campaign, records, high score and streak saved under the existing keys, when `readLocal` runs, then the Progress carries all of them unchanged; `writeLocal` of that Progress leaves those keys byte-identical.
- Given blocked storage (getItem throws), when `readLocal` runs, then it returns `emptyProgress()` and does not throw.
- Given A reached [1,2,7] with stars {1: 0b011} and best {1: 40} and B reached [1,3] with stars {1: 0b100} and best {1: 35}, when merged, then reached is [1,2,3,7], stars {1: 0b111}, best {1: 35}.
- Given A earned {devA: 300} and B earned {devA: 250, devB: 400}, when merged, then earned is {devA: 300, devB: 400}.
- Given A's streak {days 4, last 20261111} and B's {days 9, last 20261109}, when merged, then the streak is A's; given the same last day, the longer one wins.
- Given A unlocked `first-steps` at 1000 and B at 900, when merged, then it is 900.
- Given A worn hat `crown` with wornAt 5 and B `cap` with wornAt 9, when merged, then worn is B's.
- Given `mergeProgress(a, b)` and `mergeProgress(b, a)`, when compared, then they are equal; merging a result with either input again changes nothing.
- Given a fresh wallet, when `worn()` runs, then it is {skin "classic", hat "none", fireball "classic"} and those three are owned.
- Given balance 140, when `buy("hat", "cap")` (150) runs, then it returns {ok: false, need: 10} and nothing changes; with 150, then ok and the balance is 0.
- Given earned 500 and owned `skin:midnight` (500) and `hat:crown` (600) after a merge (a debt of 100), when `balance()` runs, then it is 0 and both items stay owned; after `earn(60)` it is still 0; after a further `earn(140)` it is 100.
- Given `reward("first-steps", 50)` twice, when the balance is read, then 50 was added once and the second call returned false.
- Given `wear("skin", "gold")` without owning it, when called, then it returns false and the worn skin is unchanged.
- Given a campaign with 74 stars, when `secretWorldOpen` runs, then false; at 75, true.
- Given best times for 4 of the 5 boss levels (ids 25, 27 and the other boss levels in `LEVELS`), when `bossesBeaten` runs, then 4 and `bossRushOpen` is false; with all 5, true.
- Given the catalogue, when read, then every id, name and price matches spec §2's table and each slot has exactly one free item.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/progress-save.test.js`, `tests/progress-wallet.test.js` and `tests/progress-unlocks.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test progress-`
Expected: FAIL on the assertions, with every module exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS, existing suites included

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/progress/save.js app/progress/wallet.js app/progress/stats.js app/progress/unlocks.js app/shop/catalog.js tests/progress-save.test.js tests/progress-wallet.test.js tests/progress-unlocks.test.js
git commit -m "feat(progress): progress model, wallet, catalogue and unlock rules"
```

---

### Task 2: Cloud save

**Files:**
- Create: `app/progress/cloud.js`
- Create: `app/firebase/saves.js`
- Modify: `firestore.rules` (`saves/{uid}`)
- Modify: `functions/src/handlers.js` (`handleDeleteAccount` also calls `accounts.deleteSave(uid)`)
- Modify: `functions/index.js` (implements `deleteSave`)
- Test: `tests/progress-cloud.test.js`
- Test: `tests/functions.test.js` (delete-account case)

**Interfaces:**
- Consumes: `readLocal`, `writeLocal`, `mergeProgress`, `saveBytes`, `MAX_SAVE_BYTES`, `SAVE_VERSION` (Task 1); existing `loadFirebase()`.
- Produces (used by Task 5):

```js
// app/progress/cloud.js
export const SAVE_DELAY = 5000;
export function createCloudSave(deps: {
  backend: { get(uid: string): Promise<{ v, updatedAt, data: Progress } | null>, set(uid: string, doc: { v, updatedAt, data: Progress }): Promise<void> },
  local: { read(): Progress, write(p: Progress): void },
  timers?: { setTimeout, clearTimeout }, now?: () => number,
}): {
  start(uid: string): Promise<void>,   // pull, merge, write local, push if changed
  changed(): void,                     // schedules a push SAVE_DELAY later
  flush(): Promise<void>,              // push now if dirty (page hidden)
  stop(): void,                        // signed out: stop syncing, keep local
  status(): "device" | "saved" | "pending",
};

// app/firebase/saves.js
export const firestoreSaves: { get(uid), set(uid, doc) };
```

Firestore: `saves/{uid}` = `{ v: number, updatedAt: number, data: map }`; read and write only when `request.auth.uid == uid`; writes only with exactly the keys `v`, `updatedAt`, `data`.

**Spec:**
- §1: "Cloud save runs only for a player who already has an account, anonymous or signed in. It never creates an account and never loads Firebase before the player's first input."
- §1: "Each account has one save document, `saves/{uid}`, which only that account can read or write."
- §1: "A save is at most 100 KB; a larger one is not sent, and the game keeps playing from the device copy."
- §1: "The game pulls and merges the account's save when it starts with an account, right after signing in, and right after an anonymous account is created."
- §1: "After any change, the save is sent 5 seconds later (changes in those 5 seconds go together), and when the page is hidden."
- §1: "If a save can't be sent (offline, server error), the device copy stays and the next change or start sends it. The game never shows an error for it."
- §1: "Signing in to an existing account merges this device's progress into that account."
- §1: "Signing out keeps the progress on this device."
- §1: "Deleting an account also deletes its save."

**Tags:** `security`, `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**
- Given no remote save, when `start("u1")` runs, then the local Progress is pushed once and `status()` is "saved".
- Given a remote save with stars this device lacks, when `start` runs, then the local copy gains them (written through `local.write`) and the merged save is pushed.
- Given remote equals the merge, when `start` runs, then nothing is pushed.
- Given an anonymous device's progress and an existing account's remote save, when `start(existingUid)` runs after signing in, then local and remote both end up as their merge; nothing from either is lost.
- Given three `changed()` calls within 5 s, when the timers run, then exactly one push happens 5 s after the last.
- Given `backend.set` rejects, when a push runs, then nothing throws, `status()` is "pending", and the next `changed()` push sends it.
- Given `backend.get` rejects at `start`, when it settles, then local progress is untouched and a later `start` or `changed` retries.
- Given a Progress whose `saveBytes` is 102401, when a push would run, then `backend.set` is not called and nothing throws.
- Given `stop()` after a pending change, when the timer would fire, then nothing is pushed and local progress stays.
- Given a signed-in caller, when `deleteAccount` runs, then `saves/{uid}` is deleted along with the account (functions test with fake `accounts`).
- Given the rules, when another uid reads or writes `saves/u1`, or u1 writes a key besides `v`, `updatedAt`, `data`, then it is denied (checked by reading `firestore.rules`; the repo has no rules harness).

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/progress-cloud.test.js` (fake backend and timers) and the delete case in `tests/functions.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test progress-cloud functions`
Expected: FAIL on the assertions, with `cloud.js` exporting its signature

- [ ] **Step 3: Write the minimal implementation** to the Interfaces, the rules and the delete-account change

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Check the functions load, and lint**

Run: `pnpm --dir functions check && pnpm lint`
Expected: "functions load ok", no lint errors

- [ ] **Step 6: Commit**

```bash
git add app/progress/cloud.js app/firebase/saves.js firestore.rules functions/src/handlers.js functions/index.js tests/progress-cloud.test.js tests/functions.test.js
git commit -m "feat(progress): cloud save that merges instead of overwriting"
```

---

### Task 3: Cosmetics in the game

**Files:**
- Create: `app/game/cosmetics.js`
- Modify: `app/game/player.js` (`setLook`, tinted frame sets, hat)
- Modify: `app/game/fireballs.js` (`setColour`)
- Modify: `app/game/index.js` (draw the hat after the player)
- Modify: `app/screen/index.js` (`drawHat`)
- Modify: `scripts/generate-sprites.py` (hats)
- Create: `app/assets/sprites/hats/cap.webp`, `app/assets/sprites/hats/party.webp`, `app/assets/sprites/hats/viking.webp`, `app/assets/sprites/hats/wizard.webp`, `app/assets/sprites/hats/crown.webp` (generated)
- Test: `tests/cosmetics.test.js`

**Interfaces:**
- Consumes: `CATALOG`, `FREE`, `Slot` from `app/shop/catalog.js` (Task 1).
- Produces (used by Task 5):

```js
// app/game/cosmetics.js
export const SKIN_PALETTES: Record<string, Palette>;     // one per catalogue skin
export const FIREBALL_PALETTES: Record<string, Palette>; // one per catalogue fireball
export const HAT_ANCHOR: { left: { x: number, y: number }, right: { x: number, y: number } }; // head position in a 12x12 frame
/** Recolours RGBA pixels in place: each source colour in the palette maps to its target. */
export function shiftPixels(data: Uint8ClampedArray, palette: Palette): void;
/** Canvas copies of the frames, recoloured; "classic" returns the frames themselves. */
export function tintFrames(frames: HTMLImageElement[], palette: Palette | null): HTMLCanvasElement[] | HTMLImageElement[];
export function hatImage(id: string): HTMLImageElement | null; // null for "none"
export type Palette = Array<[from: [r, g, b], to: [r, g, b]]>;

// app/game/player.js
player.setLook(look: { skin: string, hat: string }): void;
// app/game/fireballs.js
fireballs.setColour(id: string): void;
```

**Spec:**
- §2: "Cosmetics change looks only: no item changes speed, jumps, hearts, damage or score."
- §2: "Skins and fireball colours are palette shifts of the existing sprites, made when the game loads. Hats are pixel sprites drawn on the dino's head, made by `scripts/generate-sprites.py`."
- §2: "The look shows wherever the dino plays: campaign, daily, endless, worlds, the secret world and boss rush."

**Tags:** `not security: "secret" names the Starfall Peaks world; the task only draws sprites`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**
- Given every skin and fireball id in `CATALOG`, when the palettes are read, then each has one (classic may be empty).
- Given pixels [10,20,30,255, 1,2,3,255] and a palette mapping (10,20,30)→(200,100,50), when `shiftPixels` runs, then they become [200,100,50,255, 1,2,3,255]; alpha is never changed and fully transparent pixels stay untouched.
- Given skin "classic", when `tintFrames` runs, then it returns the same frame objects (no copies).
- Given hat "none", when `hatImage` runs, then null; given each other catalogue hat, an image whose src is `./assets/sprites/hats/<id>.webp`.
- Given `setLook({skin: "gold", hat: "crown"})`, when the player's physics run for 60 ticks from the same start, then position, velocity, hearts and jump count equal a classic player's.
- Given `setColour("blue")`, when a fireball is fired, then its speed, size and damage equal a classic fireball's.
- Given `python3 scripts/generate-sprites.py` runs, when it finishes, then the 5 hat files exist and are 12 px wide or less.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/cosmetics.test.js` (the sprite case is checked by running the script)

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test cosmetics`
Expected: FAIL on the assertions, with `cosmetics.js` exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces, and the hats in `scripts/generate-sprites.py`

- [ ] **Step 4: Generate the hat sprites**

Run: `python3 scripts/generate-sprites.py`
Expected: the 5 files under `app/assets/sprites/hats/`; other sprites unchanged (`git status` shows only the new hat files among assets)

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/game/cosmetics.js app/game/player.js app/game/fireballs.js app/game/index.js app/screen/index.js scripts/generate-sprites.py app/assets/sprites/hats/cap.webp app/assets/sprites/hats/party.webp app/assets/sprites/hats/viking.webp app/assets/sprites/hats/wizard.webp app/assets/sprites/hats/crown.webp tests/cosmetics.test.js
git commit -m "feat(shop): dino skins, hats and fireball colours in the game"
```

---

### Task 4: Secret world, boss rush and achievements

**Files:**
- Create: `app/modes/secret.js`
- Create: `app/modes/bossrush.js`
- Create: `app/achievements/catalog.js`
- Create: `app/achievements/check.js`
- Test: `tests/modes-secret.test.js`
- Test: `tests/achievements.test.js`

**Interfaces:**
- Consumes: `Progress`, `campaignStars`, `bossesBeaten` (Task 1); existing `createCustomSession`, `FINISH` from `app/modes/index.js`; existing `specFromPrompt`, `newWorld`, `sanitizeWorld` from `app/worlds/spec.js`; existing `LEVELS`, `areas`.
- Produces (used by Task 5):

```js
// app/modes/secret.js
export const STARFALL_ID = "starfall-peaks";
export function starfallWorld(): World;            // the same record every call
export function createSecretSession(): Session;    // a custom session with kind "secret"

// app/modes/bossrush.js
export const BOSS_RUSH_BASE = 5000;
export const MAX_HEARTS = 3;
export function bossLevels(levels?: typeof LEVELS): typeof LEVELS; // the 5, campaign order
/** heartsAfterBoss: one heart back after a boss, at most MAX_HEARTS. */
export type BossRushSession = Session & { kind: "bossrush"; key: "best"; heartsAfterBoss(hearts: number): number };
export function createBossRushSession(levels?): BossRushSession;

// app/achievements/catalog.js
export const ACHIEVEMENTS: Array<{ id: string, name: string, how: string, coins: number }>;
// app/achievements/check.js
/** Ids whose condition holds in this Progress and that aren't unlocked yet. */
export function newlyEarned(progress: Progress, levels?): string[];
/** For counters: progress toward an achievement, or null when it has no number. */
export function progressToward(id: string, progress: Progress, levels?): { have: number, need: number } | null;
```

Boss rush registers copies of the five boss arenas at `BOSS_RUSH_BASE + i`; each copy's forward exit leads to the next copy and the last one's to `FINISH`; its back exit leads nowhere.

**Spec:**
- §3: "Starfall Peaks is built into the game: 5 levels and a boss arena made from a fixed world spec, with no AI and no network."
- §3: "It plays like a shared world (its own tiles, music, enemies and boss), and its best score is kept as a record."
- §4: "Boss rush starts with 3 hearts, carries hearts from fight to fight, and gives back one heart (up to 3) after each boss."
- §4: "Losing all hearts ends the run; there is no checkpoint."
- §5: "Each achievement unlocks once and pays its coins once."
- §5: "Totals count from when phase 2 ships; the stars and streak achievements count the stars and streak the player already has."

**Tags:** `security`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**
- Given `starfallWorld()` called twice, when compared, then the records are deeply equal, have 6 levels with the last a boss arena, and pass `sanitizeWorld` unchanged.
- Given the module, when `createSecretSession()` runs with the network unavailable (no `fetch`), then it succeeds; its kind is "secret" and its world id `starfall-peaks`.
- Given `LEVELS`, when `bossLevels` runs, then it returns the five entries with `boss: true`, Grassland 6 first and the last world's boss last.
- Given a boss rush session, when its areas are read, then copy i's forward exit leads to `BOSS_RUSH_BASE + i + 1`, the fifth's to `FINISH`, and no back exit leads anywhere.
- Given hearts 1, 2 and 3, when `heartsAfterBoss` runs, then 2, 3 and 3.
- Given `ACHIEVEMENTS`, when read, then ids, names and coins match spec §5's table, 12 in all.
- Given a Progress with best[1] set, when `newlyEarned` runs, then it includes `first-steps`; with `achievements["first-steps"]` already set, it doesn't.
- Given earned coins 999, then `coin-collector` isn't earned; at 1,000 it is; `progressToward("coin-collector")` gives {have: 999, need: 1000}.
- Given owned only the three free items, then `big-spender` isn't earned; with one more owned, it is.
- Given kills summing to 500 across two devices, then `exterminator` is earned.
- Given `stats.flawlessBoss`, then `untouchable`; given `stats.secretBoss`, then `peak-performer`; given `stats.bossRushBest` set, then `rush-hour`; given 3 ids in `worldsFinished`, then `world-traveller`.
- Given every level of Iceland with the time star bit and other worlds without, then `speedy` is earned; with one Iceland level missing it, it isn't.
- Given streak best 7, then `daily-habit`; given 75 stars, `star-seeker`; given 90, `completionist`.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/modes-secret.test.js` and `tests/achievements.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test modes-secret achievements`
Expected: FAIL on the assertions, with each module exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/modes/secret.js app/modes/bossrush.js app/achievements/catalog.js app/achievements/check.js tests/modes-secret.test.js tests/achievements.test.js
git commit -m "feat(modes): Starfall Peaks, boss rush and achievement rules"
```

---

### Task 5: Shop, achievements, unlocks and cloud save on screen

**Files:**
- Modify: `app/index.js`
- Modify: `app/index.html`
- Modify: `app/index.css`
- Create: `app/progress/earn.js`
- Test: `tests/progress-earn.test.js`

**Interfaces:**
- Consumes: `createWallet`, `createStats`, `readLocal`, `writeLocal`, `secretWorldOpen`, `bossRushOpen`, `bossesBeaten`, `campaignStars`, `SECRET_STARS`, `CATALOG`, `itemOf` (Task 1); `createCloudSave`, `firestoreSaves` (Task 2); `player.setLook`, `fireballs.setColour`, `tintFrames`, `hatImage` (Task 3); `createSecretSession`, `createBossRushSession`, `ACHIEVEMENTS`, `newlyEarned`, `progressToward` (Task 4); existing `track`, `auth`, `campaign`, `showPanel`.
- Produces:

```js
// app/progress/earn.js — turns world counters into wallet and stats changes
/** Coins and kills gained since the last call for this level; a new level or a reset world starts from 0. */
export function createEarnings(): { tick(world: { id, totalCoins: number, totalEnemies: number }): { coins: number, kills: number } };
```

Screens and states:

| Screen | State | Shows |
|---|---|---|
| Home | always | "🪙 1,240" with Shop and Achievements buttons |
| Shop | item owned and worn | "Worn" |
| Shop | item owned | Wear button |
| Shop | affordable | "Buy · 300" |
| Shop | not affordable | "Need 60 more" (does nothing) |
| Shop | preview | the dino with the selected skin, hat and fireball, updated at once |
| Achievements | unlocked | name, how, "+coins", date |
| Achievements | locked with a number | name, how, "640 / 1,000" |
| Achievements | locked | name, how, greyed |
| Toast | unlocked | "🏆 First Steps · +50 coins", 3 s, one after another |
| Level select | Starfall Peaks locked | "Starfall Peaks · ★ 75 to open (you have 61)" |
| Level select | Starfall Peaks open | a card that starts the secret world |
| Level select | Boss Rush locked | "Boss Rush · beat all 5 bosses to open (3/5)" |
| Level select | Boss Rush open | a card with "Best 4:12" once finished |
| Settings | account row | "Progress saved to your account" / "Progress saved on this device" |

**Spec:**
- §1: "The game pulls and merges the account's save when it starts with an account, right after signing in, and right after an anonymous account is created."
- §1: "After any change, the save is sent 5 seconds later (changes in those 5 seconds go together), and when the page is hidden."
- §1: Settings shows the save state under the account row: "Progress saved to your account" once a save has been sent, "Progress saved on this device" with no account.
- §2: "Every coin collected in any mode adds 1 coin to the wallet, at once. Dying or quitting never takes coins back."
- §2: "One item is worn per slot. Wearing an item takes effect in the next level, and on the shop's preview at once."
- §2: The home screen shows the balance as "🪙 1,240" beside a Shop button.
- §3: Until it opens, the level select shows a locked card: "Starfall Peaks · ★ 75 to open (you have N)".
- §4: "The best time for a finished boss rush is kept as a record, and shown as "Best 4:12"."
- §4: Until it opens, it shows as a locked card: "Boss Rush · beat all 5 bosses to open (N/5)".
- §5: "When an achievement unlocks, a toast shows for 3 seconds: "🏆 <name> · +<coins> coins". Several at once show one after another."
- §6: `shop_buy` `{ item, price }` (item as `slot:id`, for example `hat:crown`)

**Tags:** `screen`, `failure-paths`, `security`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**
- Given a world whose totalCoins goes 0 → 3 → 5 within one level, when `tick` runs each time, then it yields 3 then 2 coins; when the world is set up again (new level, retry or death), counting starts from that world's own count, never giving negative or repeated coins.
- Given kills going 0 → 2, when `tick` runs, then it yields 2 kills.
- Given a player collects 5 coins and dies, when the game-over panel shows, then the wallet has 5 more coins.
- Given balance 240 and Sunset (300) selected in the shop, when the shop renders, then its button says "Need 60 more" and pressing it changes nothing; with 300, it says "Buy · 300", and buying tracks `shop_buy {item: "skin:sunset", price: 300}` and shows "Worn" after Wear.
- Given the Crown worn, when the next level starts, then the dino draws with the crown; the shop preview changed at once when Wear was pressed.
- Given the player finishes Grassland 1 for the first time, when the level ends, then the toast "🏆 First Steps · +50 coins" shows for 3 s, the balance grows by 50, and `achievement {id: "first-steps"}` is tracked; finishing it again shows nothing.
- Given two achievements unlock together, when they show, then the toasts come one after another.
- Given 61 campaign stars, when the level select opens, then it shows "Starfall Peaks · ★ 75 to open (you have 61)"; at 75, the card starts the secret world and tracks `secret_world_start`.
- Given 3 bosses beaten, when the level select opens, then "Boss Rush · beat all 5 bosses to open (3/5)"; with 5, the card starts boss rush and tracks `boss_rush_start`.
- Given a boss rush with 2 hearts left after the second boss, when the third arena starts, then the player has 3 hearts; losing all hearts shows game over and the run ends.
- Given a finished boss rush in 252 s, when the panel shows, then "Best 4:12" is kept, `boss_rush_complete {seconds: 252}` is tracked, and `rush-hour` unlocks.
- Given a campaign boss beaten without losing a heart, when the level ends, then `untouchable` unlocks.
- Given a player with an account, when the game starts, then cloud save starts after the first input and Settings says "Progress saved to your account" after the first push; with no account, Settings says "Progress saved on this device" and no Firebase code loads.
- Given the page becomes hidden with a pending change, when `visibilitychange` fires, then `flush()` runs.
- Given signing out, when the home screen shows, then wallet, stars and achievements are unchanged.
- Given widths 1280 and 844x390, when the shop, achievements screen and level select show, then nothing overflows and every button is reachable.

- [ ] **Step 1: Write the failing tests** for the `earn.js` cases in `tests/progress-earn.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test progress-earn`
Expected: FAIL on the assertions, with `earn.js` exporting its signature

- [ ] **Step 3: Write the minimal implementation** of `earn.js`, then the screens and wiring in `app/index.js`, `app/index.html` and `app/index.css`

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Check every screen state in the browser**

Run the emulators and the dev server, open the game with `?emulators=1&debug`, and walk each Acceptance case for the screens at 1280 and 844x390: home balance, every shop state, the preview, toasts, the achievements screen, both locked and open unlock cards, a boss rush, the Settings save line. Take a screenshot of each.
Expected: every state matches the table above; the console shows no errors

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/index.js app/index.html app/index.css app/progress/earn.js tests/progress-earn.test.js
git commit -m "feat(progress): shop, achievements, unlocks and cloud save on screen"
```
