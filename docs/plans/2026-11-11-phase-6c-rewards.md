# Phase 6C: Rewards (Achievements, Eggs and Companions, Daily Quests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the project's workflow policy names the executor (`run.executor`): ga:feature-build-team by default, or ga:feature-build. Follow the policy and this plan's Checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twelve more achievements, an egg in every non-boss story level and in each day's daily challenge that hatches 24 hours later into one of 8 cosmetic companions, and three daily quests with a weekly chest, all synced by cloud save.

**Architecture:** Task 1 lays the foundation every slice reads: the companion shop slot and its catalogue, the wallet's `grant`, the stored shapes of the nest, the quests and the new stats with their cloud-save merges and reset, and the 12 achievement rules. Two pure slices build on it side by side: `app/rewards/eggs.js` and `app/rewards/egg-spot.js` (with the egg object, the follower and the sprites in `app/game/` and `scripts/`), and `app/rewards/quests.js`. Task 4 wires both into the game shell: the event feed, the home cards, toasts, the hatch card, the shop tab and analytics.

**Tech Stack:** Vanilla JS ES modules bundled by webpack 5 (`app/`), HTML5 Canvas, localStorage, Firestore cloud save (`app/progress/cloud.js`), sprites generated with Python 3 and Pillow (`scripts/generate-sprites.py`), tests via `pnpm test` (esbuild + `node --test`), ESLint (`pnpm lint`), GitHub Actions CI (`.github/workflows/ci.yml`).

**Spec:** `docs/specs/2026-11-11-phase-6-combat-mobile-rewards.md` (§3 Track C, §5 Analytics)

## Global Constraints

- The branch is `feat/rewards`, cut from `feat/mobile-feel` (Track B, which is cut from Track A's `feat/combat`, `docs/plans/2026-11-11-phase-6a-combat.md`). Once Tracks A and B merge, rebase onto `master` before opening this PR.
- From Track A this plan consumes, by these names (as Track A's plan names them): `world.combo.best` (the highest combo reached in the current level, 0 after `world.combo.resetLevel()`), and the world events `"burn"` (a fireball burned an enemy projectile) and `"shield-bounce"` (a fireball bounced off a boss shield), pushed through the existing `world.emit(type)`.
- No new npm dependency; no server, Cloud Function or Firestore rules change. Track D (`players/{uid}` rules) reads this plan's `COMPANION_IDS`.
- "Cosmetics change looks only, never speed, jumps, hearts, damage or score." Companions are cosmetics.
- "The worn companion follows the dino a few steps behind, along the dino's path. It never collides, collects, hurts or changes anything; it is only drawn."
- "Every coin amount on screen (home, shop balance, prices) uses that gold coin sprite, never an emoji." Use the existing `coinText(n)` in `app/index.js`.
- An egg gives no score and no coins when found, so the daily score ceiling (`app/daily/rules.js`) is unchanged.
- Story level layouts already shipped don't change: only an `egg` field is added to their area files.
- Every storage read survives blocked or corrupt storage and every write fails silently, as `app/progress/save.js` does today.
- Player-facing copy is the spec's exactly. Where the spec gives none, this plan's copy is used as written.
- Track B also changes the home screen and menus (`app/index.html`, `app/index.css`); whichever merges second rebases and keeps both.

## Checkpoints

None (`run.checkpoints: none`). The run goes through all four tasks and stops before pushing (`git.push: ask`).

## Review Focus

1. The device clock jumps back after an egg is found: the nest never shows more than "Hatches in 24h", and the egg still hatches 24 hours after `foundAt` (Task 2 case).
2. Local midnight passes mid-level: feats after midnight count toward the new day's quests, and the old day's unfinished quests are gone (Task 3 case).
3. Two devices finish the same quest, or hatch the same egg, offline: after cloud save merges, the coins were paid once and the companion is owned once (Task 1 case).
4. Stored nest, quests or stats written by an older build or corrupted: they read as empty, never a crash, and the next write repairs them (Task 1 case).
5. A year of daily play: the save stays well under `MAX_SAVE_BYTES` (102,400), so cloud save keeps sending (Task 1 case).

---

### Task 1: Foundation: companion slot, stored shapes, merges and the 12 achievements

**Files:**

- Modify: `app/shop/catalog.js`
- Modify: `app/progress/wallet.js`
- Modify: `app/progress/save.js`
- Modify: `app/progress/stats.js`
- Modify: `app/achievements/catalog.js`
- Modify: `app/achievements/check.js`
- Test: `tests/progress-wallet.test.js`
- Test: `tests/progress-save.test.js`
- Test: `tests/achievements.test.js`

**Interfaces:**

- Consumes: existing `CATALOG`, `FREE`, `SLOTS`, `itemOf` (`app/shop/catalog.js`); existing `createWallet`, `createStats`, `createKeyStore`, `mergeProgress`, `readLocal`, `writeLocal`, `resetLocal`, `saveBytes`, `MAX_SAVE_BYTES` (`app/progress/`); existing `newlyEarned`, `progressToward`, `bossesBeaten`, `campaignStars`, `LEVELS`.
- Produces (used by Tasks 2, 3 and 4, and by Track D):

```js
// app/shop/catalog.js — a fourth slot; companions cost nothing and can only be hatched
CATALOG.companion = [
  { id: "none", name: "None", price: 0 },
  { id: "hatchling", name: "Hatchling", price: 0, hatch: "common" },
  { id: "ptero", name: "Ptero Chick", price: 0, hatch: "common" },
  { id: "trike", name: "Mini Trike", price: 0, hatch: "common" },
  { id: "stego", name: "Tiny Stego", price: 0, hatch: "common" },
  { id: "raptor", name: "Baby Raptor", price: 0, hatch: "common" },
  { id: "ankylo", name: "Little Anky", price: 0, hatch: "common" },
  { id: "golden", name: "Golden Hatchling", price: 0, hatch: "rare" },
  { id: "crystal", name: "Crystal Drake", price: 0, hatch: "rare" },
];
FREE.companion = "none";
export const COMPANION_IDS: string[];      // the 8 hatchable ids, in catalogue order (Track D's rules list them)
export const COMMON_COMPANIONS: string[];  // the 6 commons
export const RARE_COMPANIONS: string[];    // "golden", "crystal"
export function isHatchOnly(slot: string, id: string): boolean;

// app/progress/wallet.js (added to createWallet's object)
buy(slot, id): { ok: false, need: 0, hatchOnly: true } // for a hatch-only item; otherwise unchanged
grant(slot: string, id: string): boolean // owns a hatch-only item; false if unknown or already owned

// app/progress/save.js — two new keys: "nest" and "quests"
export type Nest = {
  eggs: { id: string, source: "story" | "daily" | "chest", foundAt: number }[], // unhatched only
  found: string[],    // every egg id ever found (an egg is found once)
  hatched: string[],  // every egg id ever hatched (an egg hatches once)
};
export type QuestPick = { id: string, tier: 0 | 1 | 2, target: number, coins: number, text: string, stat: string, mode?: string, enemy?: string };
export type QuestState = {
  day: number,                       // local day number (days since 1970-01-01 in local time); 0 = none yet
  picks: QuestPick[],                // the day's three quests, [] before the first read of the day
  progress: number[],                // one count per pick
  week: number,                      // the local day number of this week's Monday; 0 = none yet
  weekDone: string[],                // quest reward ids finished this week; keys = weekDone.length
  played: Record<string, number[]>,  // mode -> local day numbers it was played, last 7 days only
};
export function normalizeNest(raw): Nest;
export function normalizeQuests(raw): QuestState;
// Progress gains: nest: Nest, quests: QuestState; stats gains:
//   burned: Record<deviceId, number>, bestCombo: number, shieldlessBoss: boolean, endlessDeepest: number

// app/progress/stats.js (added to createStats's object)
addBurned(n: number): void;           // per device, like addKills
burned(): number;                     // the sum over devices
bestCombo(value: number): void;       // keeps the higher
markShieldlessBoss(): void;
endlessDeepest(level: number): void;  // keeps the higher

// app/achievements/check.js
progressToward(id, progress, levels): { have: number, need: number, unit?: string } | null
```

Merges in `mergeProgress` (order of arguments never matters; the later reset still wins outright):

- nest: `found` and `hatched` are unions; `eggs` is the union by id with the lower `foundAt`, minus every id in `hatched`.
- quests: the later `day` wins `day`, `picks` and `progress`; on the same day with the same picks, progress is the higher per pick; on the same day with different picks, the copy with more total progress wins (ties broken by the existing `cmp`). The later `week` wins `week` and `weekDone`; the same week unions `weekDone`. `played` unions per mode and keeps only days within 7 of the later `day`.
- stats: `burned` the higher per device, `bestCombo` and `endlessDeepest` the higher, `shieldlessBoss` either.

The 12 achievements, with the name, How text and coins of the spec's §3.1 table (World Conqueror 500, Grand Tour 1,000, Combo King 250, Unbroken 500, Shield Breaker 250, Sharpshooter 250, Egg Hunter 250, Full Nest 500, Questing 250, Treasure Hunter 500, Deep Diver 250, Devoted 500), and their rules (counted from the saved Progress):

- `world-conqueror`: `bossesBeaten(campaign) === 5`. Counter "n / 5 bosses".
- `grand-tour`: every `LEVELS` id has a best time and `stats.secretBoss`. Counter: levels finished plus 1 for Starfall Peaks, over `LEVELS.length + 1`, unit "levels".
- `combo-king`: `stats.bestCombo >= 20` (x4). `unbroken`: `stats.bestCombo >= 50`, counter "n / 50".
- `shield-breaker`: `stats.shieldlessBoss`.
- `sharpshooter`: burned total `>= 100`, counter unit "projectiles".
- `egg-hunter`: `nest.found.length >= 10`, unit "eggs". `full-nest`: every `COMPANION_IDS` id is in `wallet.owned`, unit "companions".
- `questing`: wallet reward ids matching `^q\d+[abc]$` `>= 25`, unit "quests". `treasure-hunter`: wallet reward ids matching `^c\d+$` `>= 4`, unit "chests".
- `deep-diver`: `stats.endlessDeepest >= 25`, unit "levels". `devoted`: streak best `>= 30`, unit "days".

**Spec:**

- §3.1: "World Conqueror and Grand Tour count progress the player already has. The other new totals count from when phase 6 ships."
- §3.1: The Achievements screen shows progress where there is a number ("3 / 5 bosses").
- §3.1: "Twelve more (24 in all)." Names, How text and coins exactly as the §3.1 table gives them (listed under Interfaces).
- §3.2: "Companions are a fourth shop slot, "Companion". The free item is "None"; companions can't be bought, only hatched."
- §3.2: "Saving: the nest (eggs with their found and hatch times) and owned companions sync through cloud save. Eggs merge by ID; owned companions are the union. Phase 2's Reset progress erases them too."
- §3.3: "Saving: today's quests and their progress, the week's keys, and the counts the mode quest uses sync through cloud save (counters take the higher value). Quest and chest coins pay through the wallet's rewards, each under its own ID, so each pays once."

**Tags:** `failure-paths`; not security: `secretBoss` is the Starfall Peaks (secret world) flag, no credentials are involved

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given the catalogue, then `SLOTS` is `["skin", "hat", "fireball", "companion"]`, `FREE.companion` is `"none"`, `COMPANION_IDS` has 8 ids, 6 commons and 2 rares (`golden`, `crystal`).
- Given a wallet with 5,000 coins, when `buy("companion", "trike")` runs, then `{ ok: false, need: 0, hatchOnly: true }` and the balance stays 5,000; when `grant("companion", "trike")` runs, then true, `owns("companion", "trike")` is true and the balance is still 5,000; a second `grant` is false; `grant("companion", "dragon")` is false.
- Given a wallet granted "trike", then `big-spender` is not earned (hatched companions aren't purchases).
- Given a fresh device, then `wallet.worn().companion` is `"none"`; `wear("companion", "trike")` is false until it is granted, true after.
- Given stored "nest" or "quests" values that are `"x"`, `[]`, `{ eggs: 5 }` or eggs with no `foundAt`, when read, then they normalize to empty (or drop just the bad eggs) and nothing throws.
- Given device A's nest `{ eggs: [{ id: "s9", foundAt: 200 }], found: ["s9"] }` and device B's `{ eggs: [{ id: "s9", foundAt: 100 }, { id: "d20261111", foundAt: 300 }], found: ["s9", "d20261111"] }`, when merged either way, then `found` has both and egg `s9` has `foundAt` 100.
- Given A hatched `s9` (`hatched: ["s9"]`, no egg) and B still holds `s9` unhatched, when merged, then `s9` is in `hatched` and not in `eggs`.
- Given A and B both paid reward `q20403a` 75 coins, when merged, then the rewards hold `q20403a: 75` once and the balance counts it once.
- Given quests on day 20403 with progress `[3, 0, 1]` and the same picks with `[1, 2, 1]`, when merged, then `[3, 2, 1]`; given day 20404 against 20403, then day 20404's picks and progress win.
- Given `weekDone` `["q20401a"]` and `["q20402b"]` in the same week, when merged, then both; given week 20405 against 20398, then week 20405's list alone.
- Given `played.daily` `[20390, 20400, 20403]` merged with a day of 20403, then `[20400, 20403]` (only days within 7).
- Given burned `{ A: 40 }` and `{ A: 30, B: 70 }`, when merged, then `{ A: 40, B: 70 }` and `burned()` is 110; `bestCombo` 12 and 31 merge to 31; `shieldlessBoss` false and true merge to true; `endlessDeepest` 9 and 26 merge to 26.
- Given Reset progress, then the nest, the quests, the new stats and companion ownership are all empty, and a merge with an older save keeps them empty.
- Given a progress with 365 days of quest reward ids (`q<day>a/b/c`), 52 chest ids, 365 daily egg ids in `found` and `hatched`, and all 8 companions owned, then `saveBytes` is under 40,000.
- Given a campaign with all five boss levels finished, then `world-conqueror` is earned; with four, then not, and `progressToward` is `{ have: 4, need: 5, unit: "bosses" }`.
- Given every `LEVELS` id finished and `secretBoss` true, then `grand-tour` is earned; without `secretBoss`, `{ have: 30, need: 31, unit: "levels" }`.
- Given `bestCombo` 19, then neither combo achievement; 20, then `combo-king`; 50, then `unbroken` too.
- Given burned 99, then no `sharpshooter`; 100, then earned.
- Given `nest.found` of 9 ids, then no `egg-hunter`; 10, then earned. Given 7 companions owned, then no `full-nest`; all 8, then earned.
- Given 24 rewards matching `q<day><a|b|c>` and an achievement reward `questing-x`, then `questing` has `have: 24`; the 25th earns it. Given 4 rewards `c<day>`, then `treasure-hunter`.
- Given `endlessDeepest` 25, then `deep-diver`; a streak best of 30, then `devoted`.
- Given every rule, then each new achievement pays its table coins once (an existing `newlyEarned` test pattern), and the catalogue has 24 entries.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/progress-wallet.test.js`, `tests/progress-save.test.js` and `tests/achievements.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test progress achievements`
Expected: FAIL on the assertions, with the new exports present as their signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces and the merge and rule lists above

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/shop/catalog.js app/progress/wallet.js app/progress/save.js app/progress/stats.js app/achievements/catalog.js app/achievements/check.js tests/progress-wallet.test.js tests/progress-save.test.js tests/achievements.test.js
git commit -m "feat(rewards): companion slot, nest and quest saves, 12 new achievements"
```

---

### Task 2: Eggs, the nest, companions and their sprites

**Files:**

- Create: `app/rewards/eggs.js`
- Create: `app/rewards/egg-spot.js`
- Create: `app/game/egg.js`
- Create: `app/game/companion.js`
- Create: `scripts/place-eggs.js`
- Modify: `scripts/generate-levels.js` (runs the egg placement on what it writes)
- Modify: `scripts/generate-sprites.py` (the egg icon and 8 companions)
- Modify: `app/game/world.js` (the egg object, `feats`, enemy kills by type)
- Create: `app/assets/sprites/items/egg.png`
- Create: `app/assets/sprites/companions/hatchling-1.png`
- Create: `app/assets/sprites/companions/hatchling-2.png`
- Create: `app/assets/sprites/companions/ptero-1.png`
- Create: `app/assets/sprites/companions/ptero-2.png`
- Create: `app/assets/sprites/companions/trike-1.png`
- Create: `app/assets/sprites/companions/trike-2.png`
- Create: `app/assets/sprites/companions/stego-1.png`
- Create: `app/assets/sprites/companions/stego-2.png`
- Create: `app/assets/sprites/companions/raptor-1.png`
- Create: `app/assets/sprites/companions/raptor-2.png`
- Create: `app/assets/sprites/companions/ankylo-1.png`
- Create: `app/assets/sprites/companions/ankylo-2.png`
- Create: `app/assets/sprites/companions/golden-1.png`
- Create: `app/assets/sprites/companions/golden-2.png`
- Create: `app/assets/sprites/companions/crystal-1.png`
- Create: `app/assets/sprites/companions/crystal-2.png`
- Modify: `app/areas/area-1.json` (an `egg` field only)
- Modify: `app/areas/area-2.json` (an `egg` field only)
- Modify: `app/areas/area-3.json` (an `egg` field only)
- Modify: `app/areas/area-7.json` (an `egg` field only)
- Modify: `app/areas/area-8.json` (an `egg` field only)
- Modify: `app/areas/area-9.json` (an `egg` field only)
- Modify: `app/areas/area-10.json` (an `egg` field only)
- Modify: `app/areas/area-11.json` (an `egg` field only)
- Modify: `app/areas/area-12.json` (an `egg` field only)
- Modify: `app/areas/area-13.json` (an `egg` field only)
- Modify: `app/areas/area-14.json` (an `egg` field only)
- Modify: `app/areas/area-15.json` (an `egg` field only)
- Modify: `app/areas/area-16.json` (an `egg` field only)
- Modify: `app/areas/area-17.json` (an `egg` field only)
- Modify: `app/areas/area-18.json` (an `egg` field only)
- Modify: `app/areas/area-19.json` (an `egg` field only)
- Modify: `app/areas/area-20.json` (an `egg` field only)
- Modify: `app/areas/area-21.json` (an `egg` field only)
- Modify: `app/areas/area-22.json` (an `egg` field only)
- Modify: `app/areas/area-23.json` (an `egg` field only)
- Modify: `app/areas/area-24.json` (an `egg` field only)
- Modify: `app/areas/area-26.json` (an `egg` field only)
- Modify: `app/areas/area-28.json` (an `egg` field only)
- Modify: `app/areas/area-30.json` (an `egg` field only)
- Modify: `app/areas/area-32.json` (an `egg` field only)
- Test: `tests/eggs.test.js`
- Test: `tests/egg-spot.test.js`

**Interfaces:**

- Consumes: `normalizeNest`, `Nest`, `createKeyStore` (Task 1); `COMPANION_IDS`, `COMMON_COMPANIONS`, `RARE_COMPANIONS`, wallet `grant`, `owns`, `reward` (Task 1); existing `unreachableInArea`, `mulberry32`, `ROWS`, `COLS` (`app/pcg/generator.js`); existing `LEVELS`; existing `world.emit`, `world.events`, the PowerUps object pattern (`app/game/powerups.js`).
- Produces (used by Task 4):

```js
// app/rewards/eggs.js — the nest, in storage key "nest" (shape: Task 1's Nest)
export const HATCH_MS = 86400000;     // 24 hours
export const RARE_CHANCE = 0.1;
export const DUPLICATE_COINS = 100;
export const storyEggId = (areaId: number) => `s${areaId}`;
export const dailyEggId = (seed: number) => `d${seed}`;
export const chestEggId = (weekDay: number) => `c${weekDay}`;
export const duplicateRewardId = (eggId: string) => `e${eggId}`;
export function dailyEggLevel(seed: number): number;      // 0..4: which daily level holds the egg, the same for everyone
export function companionFor(egg: { id: string, foundAt: number }): string; // deterministic: 10% a rare, else a common
export function hatchLabel(egg: { foundAt: number }, now: number): string;  // "Hatches in 5h" or "Ready!"
export function createNest(storage?: Storage, now?: () => number): {
  has(id: string): boolean,                                   // found before, hatched or not
  find(id: string, source: "story" | "daily" | "chest"): boolean, // false when found before
  list(): { id: string, source: string, foundAt: number, ready: boolean }[], // unhatched, oldest first
  due(): { id: string, source: string, foundAt: number }[],   // unhatched and at least HATCH_MS old
  hatch(id: string, wallet): { companion: string, duplicate: boolean } | null, // null if not due or hatched
};

// app/rewards/egg-spot.js
/** A reachable spot off the main path for an egg in an area, or null. Pure; same area + seed, same spot. */
export function eggSpot(area, seed: number): { left: number, top: number } | null;
/** The coin reachability rule from validate(), applied to an area's data. */
export function eggReachable(area, spot: { left: number, top: number }): boolean;

// area data gains (story area files; a daily area at run time):
//   egg?: { id: string, left: number, top: number }   // in tiles, like coins

// app/game/world.js
world.eggFound: (id: string) => boolean;  // set by the shell; an egg already found isn't placed
world.feats: ({ type: "kill", enemy: string } | { type: "egg", id: string })[]; // drained by the shell each frame, at most 50 kept

// app/game/companion.js
export const FOLLOW_TICKS = 10;   // how far behind the dino it walks
export function createFollower(delay?: number): {
  push(point: { x: number, y: number, direction: number }): void, // once per tick
  at(): { x: number, y: number, direction: number, moving: boolean } | null,
  reset(): void,                                                  // level start, respawn
};
export function companionFrames(id: string): HTMLImageElement[]; // [frame 1, frame 2], loaded once; [] for "none"
```

`eggSpot` rule: among the area's standable surface tiles reachable from the entry (all `t` surfaces minus `unreachableInArea`), keep those at least 3 columns from both edges, with no coin, power-up or enemy on or next to the tile above. Prefer floating platform tops (empty tile under the surface), then the highest row; break ties with `mulberry32(seed)`. The egg sits on the tile above the surface (`top` = surface row - 1 plus the coin offset), so `eggReachable` holds. Story eggs: `scripts/place-eggs.js` writes `egg: { id: "s<areaId>", left, top }` into each of the 25 area files, using `eggSpot` for generated levels and a hand-picked `HAND_SPOTS` table for the hand-made Grassland 1–3 (areas 1, 2, 7) and Iceland 1–2 (areas 3, 8). It changes nothing else in the files and exits with an error naming the area when a hand spot fails `eggReachable`. `scripts/generate-levels.js` runs the same placement on the areas it writes.

**Spec:**

- §3.2: "Every non-boss story level of the five worlds has one hidden egg. It can be found once."
- §3.2: "Each day's daily challenge has one egg in one of its five levels, the same level for everyone that day. It can be found once per day."
- §3.2: "Endless and community worlds have no eggs."
- §3.2: "Eggs sit off the main path, on higher platforms. The reachability check covers them, like coins and power-ups."
- §3.2: Hand-made story levels get their egg placed by hand. Generated story levels get theirs added to the area file by a script, without changing the layout.
- §3.2: "An egg hatches 24 hours after it was found, by the device's clock, whether or not the game is open."
- §3.2: "The home screen shows the nest: each egg with the time left ("Hatches in 5h"), or "Ready!"."
- §3.2: "An egg hatches into one of 8 companions: 6 common and 2 rare. Each hatch has a 10% chance of a rare one. A companion the player already owns pays 100 coins instead."
- §3.2: Companions are generated pixel art, like the other sprites (`pnpm sprites`).
- §3.2: "The worn companion follows the dino a few steps behind, along the dino's path. It never collides, collects, hurts or changes anything; it is only drawn."

**Tags:** `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given an empty nest at time 1,000, when `find("s9", "story")` runs, then true, `has("s9")` is true and `list()` holds it with `ready: false`; a second `find("s9", "story")` returns false and the nest is unchanged.
- Given an egg found at 0, when `hatchLabel` runs at 0, then "Hatches in 24h"; at 19 hours (68,400,000 ms), "Hatches in 5h"; at 23h 59m (86,340,000), "Hatches in 1h"; at 86,400,000, "Ready!".
- Given an egg found at 10,000 and the clock now at 5,000 (moved back), then `hatchLabel` is "Hatches in 24h" and `due()` is empty.
- Given an egg found at 0, then at 86,399,999 `due()` is empty and `hatch` returns null; at 86,400,000 `due()` has it, and `hatch("s9", wallet)` grants `companionFor(egg)`, moves `s9` to `hatched`, and a second `hatch` returns null.
- Given the hatch's companion already owned, when it hatches, then `{ duplicate: true }`, the wallet gains 100 coins under `e<eggId>`, and a repeat of the same reward pays nothing.
- Given 10,000 eggs with ids `s0`…`s9999` and `foundAt` 0, when `companionFor` runs on each, then between 8% and 12% are rare, every one of the 8 ids appears, and calling it twice on one egg gives the same id.
- Given any seed, then `dailyEggLevel` is an integer 0–4, the same on every call; across 1,000 seeds every value appears.
- Given each of the 25 non-boss story area files after `node scripts/place-eggs.js`, then each has `egg.id` `s<areaId>`, `eggReachable` holds, and every other field is byte-for-byte what it was before (compare `areaMap`, `collisonMap`, `objectsMap`, `coins`, `powerups`, `enemies`, `portals`).
- Given `node scripts/place-eggs.js` run twice, then the second run changes no file.
- Given a `HAND_SPOTS` entry inside a solid tile, when the script runs, then it exits non-zero and names that area.
- Given 200 generated daily areas, when `eggSpot(area, seed)` runs, then every non-null spot passes `eggReachable`, sits at least 3 columns from each edge and touches no coin, power-up or enemy; with a floating platform reachable, the spot is on a platform.
- Given an area whose data has an `egg` and `world.eggFound` returns false, when the dino touches the egg, then `world.feats` gets `{ type: "egg", id }`, the egg is gone, and the score and coin counts are unchanged; when `eggFound(id)` returns true at level setup, then no egg is placed.
- Given an enemy of type `slime` killed by a fireball, then `world.feats` gets `{ type: "kill", enemy: "slime" }`; given 60 feats not drained, then only the latest 50 are kept.
- Given a follower fed 15 ticks of positions x = 0…14, when `at()` runs, then x is 4 (10 ticks behind) and `moving` is true; fed one position, then that position; after `reset()`, null.
- Given `python3 scripts/generate-sprites.py`, then `app/assets/sprites/items/egg.png` and the 16 companion frames exist, and `git status` shows no other sprite changed.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/eggs.test.js` and `tests/egg-spot.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test eggs egg-spot`
Expected: FAIL on the assertions, with the new modules exporting their signatures

- [ ] **Step 3: Write the minimal implementation**: `eggs.js`, `egg-spot.js`, `egg.js`, `companion.js`, the `world.js` changes, the sprite additions, `place-eggs.js` and its call in `generate-levels.js`

- [ ] **Step 4: Generate the sprites**

Run: `python3 scripts/generate-sprites.py`
Expected: the egg icon and 16 companion frames written; no other sprite file changes in `git status`

- [ ] **Step 5: Place the story eggs**

Run: `node scripts/place-eggs.js`
Expected: 25 area files gain an `egg` field; running it again changes nothing

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, the existing level-integrity tests included

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add app/rewards/eggs.js app/rewards/egg-spot.js app/game/egg.js app/game/companion.js app/game/world.js scripts/place-eggs.js scripts/generate-levels.js scripts/generate-sprites.py app/assets/sprites/items/egg.png app/assets/sprites/companions/hatchling-1.png app/assets/sprites/companions/hatchling-2.png app/assets/sprites/companions/ptero-1.png app/assets/sprites/companions/ptero-2.png app/assets/sprites/companions/trike-1.png app/assets/sprites/companions/trike-2.png app/assets/sprites/companions/stego-1.png app/assets/sprites/companions/stego-2.png app/assets/sprites/companions/raptor-1.png app/assets/sprites/companions/raptor-2.png app/assets/sprites/companions/ankylo-1.png app/assets/sprites/companions/ankylo-2.png app/assets/sprites/companions/golden-1.png app/assets/sprites/companions/golden-2.png app/assets/sprites/companions/crystal-1.png app/assets/sprites/companions/crystal-2.png app/areas/area-1.json app/areas/area-2.json app/areas/area-3.json app/areas/area-7.json app/areas/area-8.json app/areas/area-9.json app/areas/area-10.json app/areas/area-11.json app/areas/area-12.json app/areas/area-13.json app/areas/area-14.json app/areas/area-15.json app/areas/area-16.json app/areas/area-17.json app/areas/area-18.json app/areas/area-19.json app/areas/area-20.json app/areas/area-21.json app/areas/area-22.json app/areas/area-23.json app/areas/area-24.json app/areas/area-26.json app/areas/area-28.json app/areas/area-30.json app/areas/area-32.json tests/eggs.test.js tests/egg-spot.test.js
git commit -m "feat(eggs): eggs in story and daily levels, the nest, companions and their sprites"
```

---

### Task 3: Daily quests and the weekly chest

**Files:**

- Create: `app/rewards/quests.js`
- Test: `tests/quests.test.js`

**Interfaces:**

- Consumes: `normalizeQuests`, `QuestState`, `QuestPick`, `createKeyStore` (Task 1); existing `ENEMY_TYPES` (`app/pcg/generator.js`), `LEVELS`, `bossRushOpen` (`app/progress/unlocks.js`), `mulberry32`.
- Produces (used by Task 4):

```js
// app/rewards/quests.js — state in storage key "quests" (shape: Task 1's QuestState)
export const QUEST_COINS = [50, 75, 100];   // easy, medium, hard
export const CHEST_KEYS = 12;
export const CHEST_COINS = 500;
export const MODES = ["story", "daily", "endless", "community", "bossrush"];
export function localDay(date: Date): number;   // days since 1970-01-01 of the local calendar date
export function weekStart(day: number): number; // the local day number of that week's Monday
export const questRewardId = (day: number, index: 0 | 1 | 2) => `q${day}${"abc"[index]}`;
export const chestRewardId = (weekDay: number) => `c${weekDay}`;
export type QuestContext = { unlocked: string[], metEnemies: string[] };
export function metEnemies(campaign): string[];        // enemy types of the worlds the player has reached
export function unlockedModes(campaign): string[];     // story, daily, endless, community; plus bossrush once open
export function pickQuests(day: number, played: Record<string, number[]>, context: QuestContext): QuestPick[]; // 3 picks: one per tier, one a mode quest
export type Feat =
  | { type: "kill", enemy: string }
  | { type: "coin", n: number }
  | { type: "powerup" }
  | { type: "burn" }
  | { type: "combo", value: number }
  | { type: "level", flawless: boolean }       // any level finished, in the mode given to record()
  | { type: "endless-level", level: number }   // reached endless level n
  | { type: "boss" }                           // a boss beaten
  | { type: "bossrush-finished" };
export function createQuests(storage?: Storage, now?: () => Date, context?: () => QuestContext): {
  today(): (QuestPick & { have: number, done: boolean })[], // picks today's three on the first call of a local day
  record(feat: Feat, mode: string): { finished: { pick: QuestPick, rewardId: string }[], chest: { rewardId: string, eggWeek: number } | null },
  played(mode: string): void,       // notes the mode was played today
  keys(): number,                   // this week's keys, at most 12 shown
};
```

The quest pool (counts for easy / medium / hard; the text uses the count, singular at 1):

- General: `defeat-type` "Defeat {n} {plural} with fireballs" 4 / 8 / 12, the enemy from `metEnemies` (plurals: pigs, slimes, chameleons, beetles, bats, spitter plants); `defeat` "Defeat {n} enemies" 8 / 15 / 25; `coins` "Collect {n} coins" 75 / 150 / 300; `flawless` "Finish a level without losing a heart" / "Finish {n} levels without losing a heart" 1 / 2 / 3; `combo` "Reach a x{m} combo" x2 / x3 / x4 (combo 5 / 10 / 20); `burn` "Burn {n} enemy projectiles" 3 / 5 / 8; `powerups` "Pick up {n} power-ups" 2 / 3 / 5.
- Mode: `story` "Finish a story level" / "Finish {n} story levels" 1 / 2 / 3; `daily` "Finish {n} daily levels" 2 / 3, and "Finish today's daily challenge" (all 5) for hard; `endless` "Reach endless level {n}" 3 / 5 / 8; `community` "Finish a community world level" / "Finish {n} community world levels" 1 / 2 / 4; `bossrush` "Beat {n} bosses in boss rush" 2 / 3, and "Finish boss rush" for hard.

`pickQuests`: the mode quest's mode is the unlocked mode with the fewest days in `played` within the last 7 days (ties broken by the day's seeded random); its tier is drawn from the day's seeded random; two different general quests take the other two tiers. Picks depend only on `day`, `played` and the context, so a day's picks are made once and then kept in storage. A general quest counts feats from every mode; a mode quest counts only feats recorded with its mode.

**Spec:**

- §3.3: "Each local day has three quests. They change at local midnight."
- §3.3: "One of the three is a mode quest for the unlocked mode the player has played least in the last 7 days (story, daily, endless, community, boss rush). The other two come from the general pool."
- §3.3: "Each quest comes in easy, medium and hard counts; a day's three quests are one of each, paying 50, 75 and 100 coins."
- §3.3: "A quest that names an enemy only names one the player has met in a world they have unlocked."
- §3.3: General pool (medium counts shown): "Defeat 8 slimes with fireballs", "Defeat 15 enemies", "Collect 150 coins", "Finish a level without losing a heart", "Reach a x3 combo", "Burn 5 enemy projectiles", "Pick up 3 power-ups".
- §3.3: Mode quests: "Finish today's daily challenge", "Reach endless level 5", "Finish a community world level", "Finish a story level", "Finish boss rush".
- §3.3: "Quests count in every mode except where a quest names its mode."
- §3.3: "Each finished quest gives the chest a key. A week runs Monday to Sunday, local time."
- §3.3: "12 keys in a week open the chest: 500 coins and one egg."
- §3.3: "Keys reset each Monday. Keys over 12 do nothing."

**Tags:** `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given `localDay` for 2026-11-11 23:59 and 2026-11-12 00:00 local, then two consecutive numbers; `weekStart` of Wednesday 2026-11-11 is the day number of Monday 2026-11-09, and of Sunday 2026-11-15 the same Monday.
- Given any day, then `pickQuests` returns 3 picks with tiers 0, 1 and 2 once each, coins 50, 75 and 100 to match, exactly one with a `mode`, and two different general ids.
- Given `played` with story on 5 of the last 7 days, daily on 3, endless on 1, community on 2 and boss rush locked, then the mode quest is endless; with boss rush unlocked and never played, then boss rush.
- Given a campaign that has reached only Grasslands, then every `defeat-type` pick names pig, chameleon, beetle or bat, never slime or spitter plants.
- Given the medium tier, then the texts are exactly "Defeat 8 slimes with fireballs" (enemy slime), "Defeat 15 enemies", "Collect 150 coins", "Reach a x3 combo", "Burn 5 enemy projectiles", "Pick up 3 power-ups", "Reach endless level 5"; the easy flawless text is "Finish a level without losing a heart", the hard daily text "Finish today's daily challenge", the hard boss rush text "Finish boss rush".
- Given today's quests read once, when `today()` is called again the same day with a different context, then the same picks come back.
- Given a pick "Collect 150 coins" at 140, when `record({ type: "coin", n: 15 }, "endless")` runs, then it is done with `have` 150 (capped), `finished` holds it with reward id `q<day><letter>`, and recording more coins returns nothing new.
- Given a mode quest "Reach endless level 5", when `{ type: "endless-level", level: 5 }` is recorded with mode "daily", then no progress; with mode "endless", then done.
- Given "Reach a x3 combo", when `{ type: "combo", value: 9 }` then `value: 10` is recorded, then done at 10.
- Given a quest at 3 of 8 at 23:59, when the clock passes local midnight and a feat is recorded, then it counts toward the new day's picks and the old picks are gone.
- Given 11 quests finished this week, when the 12th finishes, then `record` returns `chest: { rewardId: "c<monday>", eggWeek: <monday> }` once; a 13th returns `chest: null` and `keys()` stays 12.
- Given 12 keys on Sunday, when Monday comes, then `keys()` is 0.
- Given stored quest state that is corrupt, when `today()` runs, then fresh picks are made and nothing throws; with storage whose `setItem` throws, then `today()` and `record()` still work until the page closes.

- [ ] **Step 1: Write the failing tests** for each Acceptance case in `tests/quests.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test quests`
Expected: FAIL on the assertions, with `quests.js` exporting its signatures

- [ ] **Step 3: Write the minimal implementation** to the Interfaces and the pool above

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/rewards/quests.js tests/quests.test.js
git commit -m "feat(quests): three daily quests, a mode quest and the weekly chest"
```

---

### Task 4: Rewards in the game: feed, home cards, hatch card, shop tab, toasts and analytics

**Files:**

- Create: `app/rewards/feed.js`
- Modify: `app/index.js`
- Modify: `app/index.html`
- Modify: `app/index.css`
- Modify: `app/modes/index.js` (the daily mode puts the day's egg into its egg level)
- Test: `tests/rewards-feed.test.js`

**Interfaces:**

- Consumes: `CATALOG.companion`, `isHatchOnly`, wallet `grant`, stats `addBurned`, `bestCombo`, `markShieldlessBoss`, `endlessDeepest`, `progressToward` with `unit` (Task 1); `createNest`, `storyEggId`, `dailyEggId`, `chestEggId`, `dailyEggLevel`, `eggSpot`, `hatchLabel`, `world.eggFound`, `world.feats`, `createFollower`, `companionFrames` (Task 2); `createQuests`, `metEnemies`, `unlockedModes`, `Feat` (Task 3); from Track A: `world.combo.best`, events `"burn"` and `"shield-bounce"`; existing `showToast`, `achievementQueue`/`pumpAchievements`, `progressChanged`, `checkAchievements`, `coinText`, `finishLevel`, the mode level-complete path, `renderShop`, `drawPreview`, `openAchievements`, `refreshHome`, `drawGhost`/`drawPlayer`, `track`, the daily mode's creator in `app/modes/index.js`, `dailySeed`.
- Produces:

```js
// app/rewards/feed.js — turns one frame's world output into quest feats; pure
export function featsFrom(
  events: string[],                                     // this frame's world.events
  worldFeats: ({ type: "kill", enemy: string } | { type: "egg", id: string })[],
  coinsGained: number,                                  // from the existing earnings tick
): { feats: Feat[], eggs: string[], burned: number, shieldBounced: boolean };
```

Screens and states:

| Screen               | State            | Shows                                                                                                                                                                   |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story or daily level | egg not found    | the egg sprite, bobbing, where its area data says                                                                                                                       |
| Level                | egg touched      | toast "🥚 Egg found! It hatches in 24 hours."; the egg is gone                                                                                                          |
| Level                | companion worn   | the companion walking 10 ticks behind the dino, behind it, flipped with its direction; nothing when "None"                                                              |
| Home                 | eggs in the nest | Nest card: one row per unhatched egg, "Hatches in 5h" or "Ready!"                                                                                                       |
| Home                 | empty nest       | Nest card: "Find eggs in story levels and the daily challenge."                                                                                                         |
| Home                 | an egg due       | card "Your egg hatched! Meet <name>." with the companion, Wear and Later; a duplicate adds "You already have <name> · +<coin>100"                                       |
| Home                 | any              | Quests card: three rows, each the quest text, a progress bar with "5 / 8" (or "Done") and its coins; a chest row "🔑 7 / 12"                                            |
| Level                | quest finished   | toast "✅ <quest> · +<coin><coins>", queued with achievement toasts                                                                                                     |
| Home                 | chest opened     | toast "🎁 Weekly chest · +<coin>500 and an egg"                                                                                                                         |
| Shop                 | Companion tab    | 9 items; owned ones "Owned" or "Worn"; others "From an egg" with the action disabled and labelled "From an egg"; the preview shows the picked companion beside the dino |
| Achievements         | 24 rows          | the new ones with "n / need unit" where they have a counter, e.g. "3 / 5 bosses"                                                                                        |

**Spec:**

- §3.2: "Finding an egg shows "🥚 Egg found! It hatches in 24 hours." and it goes to the nest."
- §3.2: "The home screen shows the nest: each egg with the time left ("Hatches in 5h"), or "Ready!"."
- §3.2: "When the home screen opens and an egg is due, a card shows "Your egg hatched! Meet <name>." with Wear and Later buttons. Several due eggs hatch one after another."
- §3.2: "Wearing a companion takes effect in the next level, and on the shop's preview at once" (the phase 2 rule for every slot).
- §3.2: "Endless and community worlds have no eggs."
- §3.3: "A quest pays its coins once, when it is finished, with a toast "✅ <quest> · +<coins>"."
- §3.3: The home screen has a Quests card: three rows with progress bars ("5 / 8") and the coins each pays.
- §3.3: The Quests card shows the chest with its keys ("🔑 7 / 12").
- §3.3: "12 keys in a week open the chest: 500 coins and one egg."
- §3.1: The Achievements screen shows progress where there is a number ("3 / 5 bosses").
- §5: `egg_found` `{ source }` with source `story` or `daily`
- §5: `egg_hatched` `{ companion, duplicate }`
- §5: `quest_complete` `{ quest }`
- §5: `chest_open` `{}`

**Tags:** `screen`, `failure-paths`

**Knowledge:** none (this project has no knowledge base)

**Acceptance:**

- Given events `["kill", "burn", "burn", "powerup", "shield-bounce"]`, world feats `[{ type: "kill", enemy: "pig" }, { type: "egg", id: "s9" }]` and 3 coins gained, when `featsFrom` runs, then feats are one kill (pig), two burns, one power-up and `{ type: "coin", n: 3 }`; `eggs` is `["s9"]`, `burned` is 2 and `shieldBounced` is true.
- Given no events, no feats and 0 coins, then empty feats, no eggs, `burned` 0, `shieldBounced` false.
- Given Desert 2 with its egg unfound, when the dino touches it, then the toast "🥚 Egg found! It hatches in 24 hours." shows, the nest has `s14`, `egg_found { source: "story" }` is tracked, and replaying Desert 2 shows no egg.
- Given today's daily, then exactly the level `dailyEggLevel(seed)` holds an egg with id `d<seed>`; after it is found, a retry of the daily shows none that day; endless, a community world, Starfall Peaks and boss rush show no egg.
- Given an egg found 24 hours ago, when the home screen opens, then the hatch card shows "Your egg hatched! Meet <name>." and `egg_hatched { companion, duplicate: false }` is tracked; Wear wears it (it walks behind the dino in the next level); Later closes the card; two due eggs show two cards one after the other.
- Given a duplicate hatch, then the card adds "You already have <name> · +<coin>100", the balance rises by 100 and `egg_hatched { duplicate: true }` is tracked.
- Given a worn companion, when the dino runs, jumps and dies, then the companion follows 10 ticks behind and never blocks, collects or hurts anything; after a respawn it starts at the dino.
- Given a quest finished mid-level, then its toast "✅ <quest> · +<coin><coins>" shows after any toast already showing, the balance rises by its coins once, and `quest_complete { quest: <id> }` is tracked.
- Given the 12th key of the week, then the chest toast "🎁 Weekly chest · +<coin>500 and an egg" shows, 500 coins are paid once, an egg `c<monday>` goes to the nest and `chest_open {}` is tracked.
- Given a fireball bouncing off a boss shield in a boss level, then beating that boss doesn't mark `shieldlessBoss`; a boss beaten with no bounce in its level marks it.
- Given an endless run reaching level 26, then `stats.endlessDeepest` is 26; a level finished with `world.combo.best` 22 makes `stats.bestCombo` at least 22.
- Given a mode started from the home screen, then `quests.played(<mode>)` is called once for it (story, daily, endless, community or bossrush; Starfall Peaks counts as community).
- Given the shop's Companion tab, then 9 items show, "None" is owned and worn by default, a companion not owned shows "From an egg" and its action button is disabled; picking an owned one previews it beside the dino.
- Given the Achievements screen, then 24 rows show, and `world-conqueror` at 3 bosses reads "3 / 5 bosses".
- Given storage that throws on every write, when eggs are found and quests finished, then the toasts still show and nothing throws.
- Given widths 390 and 1280, when the Nest card, Quests card, hatch card, Companion tab and Achievements screen show, then nothing overflows and every button is reachable.

- [ ] **Step 1: Write the failing tests** for the `featsFrom` cases in `tests/rewards-feed.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test rewards-feed`
Expected: FAIL on the assertions, with `feed.js` exporting `featsFrom`

- [ ] **Step 3: Write the minimal implementation**: `feed.js`; then in `app/index.js`, `app/index.html` and `app/index.css` the per-frame feed into quests and stats, the egg wiring (`world.eggFound`, the daily egg in `app/modes/index.js`), the follower drawing, the Nest, Quests and hatch cards, the quest and chest toasts, the Companion tab and preview, the achievement units and the four analytics events

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Check every screen state in the browser**

Start the `game` preview (`.claude/launch.json`, port 2108) and open `http://localhost:2108/?debug`. Walk each row of the Screens and states table and each Acceptance case at widths 390 and 1280: find a story egg and the daily egg, set an egg's `foundAt` back 24 hours in localStorage to hatch it (new and duplicate), wear a companion and play a level, finish a quest, set `weekDone` to 11 ids to open the chest, open the Companion tab and the Achievements screen. Take a screenshot of each.
Expected: every state matches the table; the console shows no errors

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/rewards/feed.js app/index.js app/index.html app/index.css app/modes/index.js tests/rewards-feed.test.js
git commit -m "feat(rewards): eggs, companions, quests and the weekly chest in the game"
```
