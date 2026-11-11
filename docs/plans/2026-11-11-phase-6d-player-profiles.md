# Phase 6, Track D: Player Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: the project's workflow policy names the executor (`run.executor`): ga:feature-build-team by default, or ga:feature-build. Follow the policy and this plan's Checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every row on the daily and endless boards shows the player's dino (skin, hat, companion) and, unless they hide it, the day they were last online, read from a public `players/{uid}` profile each player writes for themselves.

**Architecture:** A pure module, `app/profiles/rules.js`, owns the profile's shape: the allowed item IDs (from the shop catalogue), the UTC day number, the payload a player writes and the "last online" label. `firestore.rules` gets a `players/{uid}` match that enforces the same shape, tested against the Firestore emulator. A client module, `app/profiles/index.js`, writes the player's own profile when it changes and reads profiles in batches of 30 for the boards, through a Firestore adapter in `app/firebase/profiles.js`. The board draws each avatar once per combination; account deletion removes the profile.

**Tech Stack:** Vanilla JS ES modules bundled by webpack 5 (`app/`), HTML5 Canvas, Firebase 13 (Firestore, Auth, callable Functions in `functions/`, Node 24, `firebase-admin`), localStorage, tests via `pnpm test` (esbuild + `node --test`), ESLint 10 (`pnpm lint`), GitHub Actions CI (`.github/workflows/ci.yml`). New dev dependencies: `@firebase/rules-unit-testing` and `firebase-tools` (emulator, for rules tests only).

**Spec:** `docs/specs/2026-11-11-phase-6-combat-mobile-rewards.md` (§4, Track D)

## Global Constraints

- The branch is `feat/player-profiles`, cut from `feat/rewards` (Track C), which adds the `companion` slot to `app/shop/catalog.js`. Once Track C merges, rebase onto `master` before opening the PR.
- Phase 1: "Names on the board come from the server … The client never sends a name." Names stay as they are; D adds looks and a day, never a name.
- Phase 2: "Cosmetics change looks only, never speed, jumps, hearts, damage or score." Companions are cosmetics.
- "Only the day is stored, never a time."
- A profile holds exactly `skin`, `hat`, `companion` and, optionally, `seenDay`. Nothing else, ever: no name, no uid field, no timestamp.
- Firebase stays unloaded until the player's first input (phase 2 rule for cloud save); profile writes ride on the same start.
- Every profile read or write that fails leaves the game and the board working: nothing is shown to the player for a failed profile write.
- Player-facing copy is the spec's exactly.

## Checkpoints

- After Task 2 (`security`): the run stops for the developer to read the `players/{uid}` rules and their emulator tests before anything writes public personal data. `run.checkpoints` is `none`; this stop is added because Track D publishes data about every player with an account (their looks and the day they were last online), and the rules are the only thing standing between a client and that collection.
- The run stops before pushing (`git.push: ask`).

## Review Focus

1. A device clock a day off from the server: the client's `seenDay` is refused by the rules; the refusal is swallowed, the worn items are still written on the next change, and nothing is retried in a loop (Task 3 case).
2. A profile written by another client with a field the game doesn't know, or an item ID from a later build (a skin this build has no palette for): the board draws the free item for that slot instead of crashing (Task 4 case).
3. A board where a player's profile doesn't exist (anonymous player who never acted, or a profile deleted with its account): the row shows the classic dino and no status (Task 4 case).
4. Turning "Show when I was last online" off while offline: the switch stays off, and the next successful write removes `seenDay` (Task 3 case).
5. The profile query refused or timing out: the board's rows still show, with classic dinos, and "Leaderboard didn't load." never appears for a profile failure alone (Task 4 case).

---

### Task 1: The profile contract and the rules-test harness

**Files:**

- Create: `app/profiles/rules.js`
- Create: `scripts/test-rules.js`
- Modify: `package.json` (dev dependencies `@firebase/rules-unit-testing`, `firebase-tools`; script `test:rules`)
- Modify: `pnpm-lock.yaml`
- Test: `tests/profiles-rules.test.js`

**Interfaces:**

- Consumes: existing `CATALOG` and `FREE` from `app/shop/catalog.js`, including the `companion` slot Track C adds (`FREE.companion === "none"`).
- Produces (used by Tasks 2, 3 and 4):

```js
// app/profiles/rules.js
export const DAY_MS = 86400000;
export const PROFILE_BATCH = 30;                 // Firestore "in" limit, and the rules' list limit
export const PROFILE_FIELDS = ["skin", "hat", "companion", "seenDay"];
export const PROFILE_SLOTS = ["skin", "hat", "companion"];
/** Item IDs a profile may hold, per slot, straight from the shop catalogue. */
export const PROFILE_IDS: { skin: string[], hat: string[], companion: string[] };
/** The UTC day number: Math.floor(ms / DAY_MS). The rules compute the same from request.time. */
export function dayNumber(ms: number): number;
/** The document a player writes: the worn items, plus seenDay only when showLastSeen is true. */
export function profilePayload(
  worn: { skin?: string, hat?: string, companion?: string },
  { showLastSeen: boolean, now: number },
): { skin: string, hat: string, companion: string, seenDay?: number };
/** A profile read from Firestore, made safe to draw: unknown or missing items become the slot's free item; a seenDay that isn't a whole number is dropped. null in → null out. */
export function cleanProfile(raw: unknown): { skin: string, hat: string, companion: string, seenDay: number | null } | null;
/** "Today" | "Yesterday" | "<n>d ago" | "1w ago" | "2w+ ago", or "" when seenDay is null. */
export function lastSeenLabel(seenDay: number | null, today: number): string;
```

```json
// package.json scripts (added)
"test:rules": "firebase emulators:exec --only firestore --project demo-dino \"node scripts/test-rules.js\""
```

`scripts/test-rules.js` bundles every `tests/rules/*.test.js` with esbuild and runs them with `node --test`, as `scripts/test.js` does for `tests/*.test.js` (which reads only the top level of `tests/`, so `pnpm test` never needs the emulator). The `demo-` project prefix keeps the emulator offline.

**Spec:**

- §4.1: "Each player with an account has a public profile document `players/{uid}`: `{ skin, hat, companion, seenDay }`."
- §4.3: "Each row shows when the player was last online: "Today", "Yesterday", "3d ago" (up to 6 days), "1w ago" (7 to 13 days) or "2w+ ago"."
- §4.3: "Only the day is stored, never a time."
- §4.2: "A player with no profile shows the classic dino."

**Tags:** not security: pure functions and a test runner; the rules that guard the data are Task 2.

**Acceptance:**

- `PROFILE_IDS.skin` equals the IDs of `CATALOG.skin` in order (`classic`, `mint`, `sunset`, `midnight`, `ghost`, `gold`); `PROFILE_IDS.hat` the IDs of `CATALOG.hat`; `PROFILE_IDS.companion` the IDs of `CATALOG.companion`, starting with `none`.
- `dayNumber(Date.UTC(2026, 10, 11, 23, 59, 59))` is `20768`, and one second later it is `20769`.
- `profilePayload({ skin: "mint", hat: "crown", companion: "none" }, { showLastSeen: true, now: Date.UTC(2026, 10, 11, 12) })` is `{ skin: "mint", hat: "crown", companion: "none", seenDay: 20768 }`.
- The same call with `showLastSeen: false` has no `seenDay` key at all (not `null`, not `undefined`).
- `profilePayload({}, …)` fills each slot with its free item: `{ skin: "classic", hat: "none", companion: "none" }`.
- `profilePayload` never returns a key outside `PROFILE_FIELDS`, even when `worn` carries `fireball: "blue"` or `name: "x"`.
- `cleanProfile({ skin: "rainbow", hat: "crown", companion: 7, seenDay: 20765 })` is `{ skin: "classic", hat: "crown", companion: "none", seenDay: 20765 }`.
- `cleanProfile({ skin: "mint", hat: "cap", companion: "none", seenDay: "20765" })` has `seenDay: null`; so does `seenDay: 20765.5`.
- `cleanProfile(null)` and `cleanProfile("x")` are `null`.
- `lastSeenLabel` with `today = 20768`: `20768` → "Today"; `20767` → "Yesterday"; `20766` → "2d ago"; `20762` → "6d ago"; `20761` → "1w ago"; `20755` → "1w ago"; `20754` → "2w+ ago"; `null` → ""; `20769` (a viewer's clock behind the writer's) → "Today".

- [ ] **Step 1: Write the failing tests** for each Acceptance case, in `tests/profiles-rules.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test profiles-rules`
Expected: FAIL on the assertions. Create `app/profiles/rules.js` with the exported names and signatures first, so the tests fail on behaviour, not on a missing module.

- [ ] **Step 3: Write the minimal implementation** of `app/profiles/rules.js` to the Interfaces, until the tests pass

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test profiles-rules`
Expected: PASS

- [ ] **Step 5: Add the rules-test harness**: `pnpm add -D @firebase/rules-unit-testing firebase-tools`, the `test:rules` script, and `scripts/test-rules.js`

- [ ] **Step 6: Run the lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/profiles/rules.js tests/profiles-rules.test.js scripts/test-rules.js package.json pnpm-lock.yaml
git commit -m "feat(profiles): profile shape, day numbers, last-online labels and a rules-test harness"
```

---

### Task 2: Firestore rules for `players/{uid}`

**Files:**

- Modify: `firestore.rules` (header comment and a `match /players/{uid}` block before the catch-all)
- Modify: `.github/workflows/ci.yml` (Java and a `pnpm test:rules` step in the `test` job)
- Create: `tests/rules/players.test.js`
- Test: `tests/profiles-rules-file.test.js`

**Interfaces:**

- Consumes: `PROFILE_IDS`, `PROFILE_FIELDS`, `PROFILE_BATCH`, `dayNumber()` from `app/profiles/rules.js` (Task 1); the `test:rules` script and `scripts/test-rules.js` (Task 1).
- Produces (relied on by Tasks 3 and 4):

| Operation                        | Who                                                                        | Allowed when                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get players/{uid}`              | anyone                                                                     | always                                                                                                                                                                                                       |
| `list players`                   | anyone                                                                     | `request.query.limit <= 30`                                                                                                                                                                                  |
| `create`, `update players/{uid}` | that account only (`request.auth.uid == uid`, anonymous accounts included) | keys only `skin`, `hat`, `companion`, `seenDay`; `skin`, `hat`, `companion` all present, each a string in its slot's ID list; `seenDay` absent, or an int equal to `int(request.time.toMillis() / 86400000)` |
| `delete players/{uid}`           | nobody from a client                                                       | never (the `deleteAccount` function deletes it, Task 5)                                                                                                                                                      |

The rules hold the three ID lists as literal lists. They can't import the catalogue, so `tests/profiles-rules-file.test.js` (run by `pnpm test`) reads `firestore.rules` and checks each literal list equals `PROFILE_IDS` for its slot.

**Spec:**

- §4.1: "A player writes only their own profile. Firestore rules allow only those four fields, only item IDs that exist, and `seenDay` only as today's or yesterday's UTC day number from the server's time (`request.time`), so a device clock a day off still counts."
- §4.3: "Only the day is stored, never a time."

**Tags:** security

**Acceptance:** (emulator tests in `tests/rules/players.test.js`, run by `pnpm test:rules`)

- Given account `u1`, when it sets `players/u1` to `{ skin: "mint", hat: "cap", companion: "none", seenDay: <today> }`, then the write succeeds.
- Given account `u1`, when it sets the same without `seenDay`, then the write succeeds.
- Given account `u1`, when it writes `players/u2`, then the write is denied.
- Given no account, when anyone writes `players/u1`, then the write is denied.
- Given an anonymous account `a1`, when it writes a valid `players/a1`, then the write succeeds.
- An extra field (`name: "Rex"`, `uid: "u1"`, `seenAt: <timestamp>`) is denied.
- A missing slot (no `hat`) is denied.
- An item ID that doesn't exist (`skin: "rainbow"`, `hat: "CROWN"`, `companion: ""`) is denied.
- A non-string item (`skin: 3`, `hat: ["cap"]`) is denied.
- A 10,000-character `skin` string is denied.
- Given account `u1`, when it sets `players/u1` with `seenDay` of yesterday (by the emulator's time), then the write succeeds.
- `seenDay` of two days ago or tomorrow (by the emulator's time), as a float (`20768.5`), or as a string, is denied.
- A client `delete` of its own `players/u1` is denied.
- `get players/u1` with no account succeeds.
- A query on `players` with `limit(30)` succeeds; with `limit(31)` or no limit, it is denied.
- The rules' other matches still hold: `saves/u1` stays unreadable to `u2`, and a write to an unmatched path (`foo/bar`) is denied.
- (`pnpm test`) `tests/profiles-rules-file.test.js`: each literal ID list in the `players` match equals `PROFILE_IDS` for its slot, and the `match /{document=**}` catch-all still comes after `match /players/{uid}`.

- [ ] **Step 1: Write the failing tests** for each Acceptance case, in `tests/rules/players.test.js` and `tests/profiles-rules-file.test.js`

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:rules`
Expected: FAIL: every write is denied by the catch-all, so the allowed cases fail.

- [ ] **Step 3: Write the `players/{uid}` match** in `firestore.rules`, with a header comment in the style of the others, until the tests pass

- [ ] **Step 4: Run the emulator tests to verify they pass**

Run: `pnpm test:rules`
Expected: PASS

- [ ] **Step 5: Run the game tests to verify the file check passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Add the rules tests to CI**: in `.github/workflows/ci.yml`'s `test` job, after "Tests", an `actions/setup-java` step (Temurin 21) and a step "Firestore rules" running `pnpm test:rules`

- [ ] **Step 7: Run the lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add firestore.rules tests/rules/players.test.js tests/profiles-rules-file.test.js .github/workflows/ci.yml
git commit -m "feat(profiles): firestore rules for players/{uid}, tested against the emulator"
```

---

### Task 3: Writing the player's own profile, and the Settings switch

**Files:**

- Create: `app/profiles/index.js`
- Create: `app/firebase/profiles.js`
- Modify: `app/util/settings.js` (default `lastSeen: true`)
- Modify: `app/index.html` (Settings row "Show when I was last online", checkbox `setLastSeen`)
- Modify: `app/index.js` (start profile sync with cloud save; sync after wearing an item; the Settings switch)
- Test: `tests/profiles-sync.test.js`

**Interfaces:**

- Consumes: `profilePayload()`, `dayNumber()`, `cleanProfile()`, `PROFILE_BATCH` from `app/profiles/rules.js` (Task 1); existing `loadFirebase()` from `app/firebase/index.js`; existing `wallet.worn()` from `app/progress/wallet.js`; existing `settings` from `app/util/settings.js`; existing `syncCloud()` start point and the wear call site in the shop in `app/index.js`; Track C's companion "Wear" button, which calls `wallet.wear("companion", id)`.
- Produces (used by Task 4):

```js
// app/firebase/profiles.js — the plain backend app/profiles/index.js expects. Errors propagate.
export const firestoreProfiles = {
  set(uid: string, profile: { skin, hat, companion, seenDay? }): Promise<void>, // setDoc, full replace (no merge)
  /** One query per call: where(documentId(), "in", uids), limit(PROFILE_BATCH). uids.length <= 30. */
  getMany(uids: string[]): Promise<Array<{ uid: string, data: object }>>,
};

// app/profiles/index.js
export function createProfiles({ backend, storage, now = Date.now }): {
  /** Writes uid's profile when it differs from the last one written from this device for that uid. */
  sync(uid: string, worn: object, { showLastSeen: boolean }): Promise<void>,
  /** Clean profiles by uid for any number of uids: batches of PROFILE_BATCH, one query each, cached for the session. */
  fetch(uids: string[]): Promise<Map<string, ReturnType<typeof cleanProfile>>>,
};
export const profiles; // createProfiles({ backend: firestoreProfiles, storage: localStorage })
```

The "last written" record is kept in localStorage under `profile` as `{ uid, payload }`, so reopening the game on the same day writes nothing.

**Spec:**

- §4.1: "The profile is written when the player's worn items change, and when the game opens on a day not yet recorded. A player without an account has no profile."
- §4.3: "Settings has a switch "Show when I was last online", on by default. Turning it off deletes `seenDay` from the profile, and no `seenDay` is written until it is on again. Worn items still update the avatar. A row with no `seenDay` shows no status."
- §4.1: "A player writes only their own profile."

**Tags:** security, failure-paths

**Acceptance:**

- Given account `u1` wearing `{ skin: "mint", hat: "cap", companion: "none" }` and the switch on, when cloud save starts for `u1`, then `backend.set("u1", { skin: "mint", hat: "cap", companion: "none", seenDay: <today> })` is called once.
- Given that write succeeded, when the game opens again the same UTC day with the same worn items, then `backend.set` is not called.
- Given that write, when the next UTC day's open happens, then `backend.set` is called with the new `seenDay`.
- Given the switch on, when the player wears `hat: "crown"`, then `backend.set` is called with `hat: "crown"`.
- Given the switch turned off, then `backend.set` is called once with no `seenDay` key; and when the game opens on later days with the same worn items, `backend.set` is not called.
- Given the switch off, when the player wears a new skin, then `backend.set` is called with the new skin and no `seenDay`.
- Given the switch turned back on, then `backend.set` is called with today's `seenDay`.
- Given no account (no `auth.currentUser`), when the player wears an item, then `backend.set` is never called and Firebase isn't loaded.
- Given `backend.set` rejects (offline, or `permission-denied` from a device clock a day off), when `sync` runs, then it resolves without throwing, nothing is shown to the player, the "last written" record is unchanged (so the next open or change tries again), and it is not retried in a loop.
- Given the switch is turned off while offline, then the setting stays off, and the next successful write has no `seenDay`.
- Given a different account signs in on the device (`u2`), then `u2`'s own profile is written, and `u1`'s is never touched.
- Given localStorage throws on read or write, then `sync` still writes (it just can't skip repeats).
- `fetch(["a", …])` with 51 uids calls `backend.getMany` twice (30, then 21); a second `fetch` of the same uids in the session calls it zero times.
- `fetch` returns `cleanProfile` output per uid; a uid with no document is absent from the map.
- Given `backend.getMany` rejects, then `fetch` rejects (Task 4 decides what the board shows), and nothing is cached for those uids.
- Settings shows "Show when I was last online", checked by default.

- [ ] **Step 1: Write the failing tests** for each Acceptance case, in `tests/profiles-sync.test.js`, against a fake backend and a fake storage

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test profiles-sync`
Expected: FAIL on the assertions. Create `app/profiles/index.js` exporting `createProfiles` with its real signature first.

- [ ] **Step 3: Write `app/profiles/index.js`** to the Interfaces, until the tests pass

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test profiles-sync`
Expected: PASS

- [ ] **Step 5: Write `app/firebase/profiles.js`** and wire it in `app/index.js`: `profiles.sync` when cloud save starts for an account, after a successful `wallet.wear`, and when the switch changes; add the Settings row in `app/index.html` and the `lastSeen` default in `app/util/settings.js`

- [ ] **Step 6: Check it in the browser** at 390 and 1280 widths against the Firebase emulators (they load `firestore.rules`; until Task 2's `players` match is in, the write is refused and the switch still works) (`pnpm emulators`, then `pnpm dev` and open `http://localhost:2108/?emulators=1`): the Settings row shows and toggles; the Firestore emulator UI shows `players/<uid>` with `seenDay` after the first input, and without it after the switch goes off

- [ ] **Step 7: Run the tests and the lint**

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add app/profiles/index.js app/firebase/profiles.js app/util/settings.js app/index.html app/index.js tests/profiles-sync.test.js
git commit -m "feat(profiles): write the player's own profile and a switch to hide last online"
```

---

### Task 4: Avatars and last online on the boards

**Files:**

- Create: `app/profiles/avatar.js`
- Modify: `app/index.js` (`boardRow` and `loadLeaderboard`)
- Modify: `app/index.css` (`.lb-avatar`, `.lb-seen`)
- Test: `tests/profiles-board.test.js`

**Interfaces:**

- Consumes: `cleanProfile()`, `lastSeenLabel()`, `dayNumber()` from `app/profiles/rules.js` (Task 1); `profiles.fetch()` from `app/profiles/index.js` (Task 3); existing `SKIN_PALETTES`, `tintFrames()`, `hatImage()`, `drawHat()` from `app/game/cosmetics.js`; Track C's `companionFrames(id)` from `app/game/companion.js` (Track C Task 2: `[frame 1, frame 2]`, loaded once, `[]` for `none`; the avatar uses frame 1); existing `boardRow` and `loadLeaderboard` in `app/index.js`.
- Produces:

```js
// app/profiles/avatar.js
export const AVATAR_SIZE = 28; // css px; drawn at devicePixelRatio
/** The cache key for a combination. */
export function avatarKey(profile: { skin, hat, companion } | null): string; // null → the classic key
/** A canvas with the dino's idle frame in the skin, the hat on its head, the companion beside it. Drawn once per key until the page reloads; later calls return a copy of the cached drawing. Sprites not yet loaded draw when they load. */
export function avatarCanvas(profile: { skin, hat, companion } | null): HTMLCanvasElement;
```

**Spec:**

- §4.2: "Each row on the daily and endless boards shows the player's dino in their skin and hat, with their companion."
- §4.2: "A player with no profile shows the classic dino."
- §4.2: Avatars are drawn once per combination and kept for the session. The board reads profiles in batches of 30 (two queries for the top 50, plus the pinned row).
- §4.2: If profiles fail to load, the board still shows, with classic dinos.
- §4.3: "Each row shows when the player was last online: "Today", "Yesterday", "3d ago" (up to 6 days), "1w ago" (7 to 13 days) or "2w+ ago"."
- §4.3: "A row with no `seenDay` shows no status."

**Tags:** screen, failure-paths, security

**Acceptance:**

- `avatarKey(null)` equals `avatarKey({ skin: "classic", hat: "none", companion: "none" })`; two different combinations have different keys.
- Given the top 50 and a pinned row (51 uids), when the board loads, then `profiles.fetch` is called once with all 51 uids, and the rows show before it resolves (each with the classic dino), then update in place.
- Given a profile `{ skin: "gold", hat: "crown", companion: <a Track C companion id>, seenDay: today - 3 }`, then the row's avatar is the gold dino with the crown and that companion, and its status reads "3d ago".
- Given a profile with `seenDay: null`, then the row shows its avatar and no status text (the `.lb-seen` cell is empty, not "Today").
- Given no profile for a uid, then the row shows the classic dino and no status.
- Given a profile holding an item this build doesn't know (`skin: "rainbow"`), then that slot draws its free item, and the board doesn't throw.
- Given a profile whose values are markup (`hat: "<img src=x onerror=alert(1)>"`, written by a client that bypassed an older rule), then nothing is parsed as HTML: the slot draws its free item and no element other than the row's own cells is created.
- Given 120 uids passed to `profiles.fetch`, then no single query asks for more than 30, matching the rules' list limit.
- Given `profiles.fetch` rejects (the query refused, or offline), then every row stays with the classic dino and no status, the board's rows all show, and the status line does not say "Leaderboard didn't load.".
- Given the player switches tabs (Today → Endless) before profiles arrive, then the late profiles are not painted onto the new tab's rows.
- Given 20 rows sharing one combination, then that avatar is drawn once (the drawing function runs once per key until the page reloads).
- In the browser at 390 and 1280 widths: each row shows rank, avatar, name, (level on Endless), score, time and the status, on one line, with no text overlapping and the name truncated with an ellipsis when long. The player's own and pinned rows keep their highlights.

- [ ] **Step 1: Write the failing tests** for each Acceptance case that doesn't need a browser, in `tests/profiles-board.test.js`. Put the board's profile merge (rows in, `fetch` result in, per-row `{ avatarKey, seen }` out, with the tab-switch guard) in a function exported from `app/profiles/avatar.js` as `rowLooks(rows, profilesByUid, today)` so it runs in Node

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test profiles-board`
Expected: FAIL on the assertions. Create `app/profiles/avatar.js` with the exported names first.

- [ ] **Step 3: Write `app/profiles/avatar.js`** to the Interfaces, until the tests pass

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test profiles-board`
Expected: PASS

- [ ] **Step 5: Wire the board** in `app/index.js`: `boardRow` adds `.lb-avatar` (the canvas) after the rank and `.lb-seen` after the time; `loadLeaderboard` fetches the profiles after the rows render, guarded by `board.load`; style both cells in `app/index.css`

- [ ] **Step 6: Check it in the browser** at 390 and 1280 widths against the emulators, with three players: one with a profile and `seenDay`, one with the switch off, one with no profile. Check the Today and Endless tabs and a pinned row, and take a screenshot of each width for the PR

- [ ] **Step 7: Run the tests and the lint**

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add app/profiles/avatar.js app/index.js app/index.css tests/profiles-board.test.js
git commit -m "feat(leaderboards): avatars and last online on the daily and endless boards"
```

---

### Task 5: Account deletion removes the profile; PRIVACY.md

**Files:**

- Modify: `functions/src/handlers.js` (`handleDeleteAccount` and its comment)
- Modify: `functions/index.js` (`accounts.deleteProfile`, and the `deleteAccount` comment)
- Modify: `PRIVACY.md`
- Test: `tests/functions.test.js`

**Interfaces:**

- Consumes: existing `handleDeleteAccount({ auth }, { accounts })` and the `accounts` adapter in `functions/index.js`; the `players/{uid}` collection (Task 2).
- Produces:

```js
// functions/index.js accounts adapter (added)
deleteProfile(uid: string): Promise<void>; // db.collection("players").doc(uid).delete()
```

`handleDeleteAccount` calls, in order: `anonymizeWorlds`, `deleteDailyScores`, `deleteEndless`, `deleteSave`, `deleteProfile`, `deleteReminders`, `deleteData`, `deleteUser`.

**Spec:**

- §4.1: "Deleting an account deletes its profile."
- §4.3: `PRIVACY.md` says what the profile holds, that it is public, and how to hide last online.

**Tags:** security

**Acceptance:**

- Given a signed-in `u9`, when `deleteAccount` runs, then `accounts` is called in the order above, with `["profile", "u9"]` after `["save", "u9"]` and before `["reminders", "u9"]`.
- Given no account, then `deleteAccount` rejects with `unauthenticated` and no `accounts` method is called (the existing case still holds).
- Given `anonymizeWorlds` throws, then `deleteProfile` is not called and the account isn't deleted (the existing case still holds).
- Given `deleteProfile` throws, then `deleteUser` is not called, and the error reaches the caller.
- `PRIVACY.md` has a section that says: the profile holds the worn skin, hat and companion, and the UTC day the player last opened the game (never a time); it is public to every player and shown on the leaderboards; it exists for any player with an account, anonymous included; "Show when I was last online" in Settings hides the day; deleting the account deletes the profile.

- [ ] **Step 1: Write the failing tests** for each Acceptance case, in `tests/functions.test.js` (the existing `deleteAccount` test gains `deleteProfile`)

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test functions`
Expected: FAIL on the call order.

- [ ] **Step 3: Add `deleteProfile`** to `handleDeleteAccount` and the `accounts` adapter, until the tests pass

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test functions`
Expected: PASS

- [ ] **Step 5: Write the PRIVACY.md section** "Leaderboard Profile", after "Accounts and Shared Worlds", and add the profile to "Your Choices"

- [ ] **Step 6: Check the functions still load**

Run: `pnpm --dir functions check`
Expected: `functions load ok`

- [ ] **Step 7: Run the lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add functions/src/handlers.js functions/index.js tests/functions.test.js PRIVACY.md
git commit -m "feat(profiles): deleting an account deletes its profile; privacy policy"
```
