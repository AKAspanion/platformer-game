# Phase 6: Combat, Mobile Feel, Rewards and Player Profiles

Follows the engagement roadmap (`docs/specs/2026-11-11-engagement-roadmap.md`, phases 1–5).
Builds on the daily and endless boards, cloud save, the wallet and shop, achievements,
ghost runs and the Settings switches.

**Goal:** fights ask more of the player, the game feels right on a phone, and players have
more to collect and a reason to open the game every day: quests, a weekly chest and eggs
that hatch tomorrow.

**Who it's for:** mostly phone players, in landscape.

## 0. Tracks

Each track gets its own plan in `docs/plans/` and ships on its own branch. They can be
built in any order, with one exception: C3's "Reach a x3 combo" quest and C1's combo
achievements need A3.

| Track | Ships                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Boss shield, walkers that shoot at medium range, combo meter                                                                                |
| B     | See-through controls, pause at the bottom middle, device-only Help, compact menus, next level preloaded, platforms in every generated level |
| C     | 12 more achievements, eggs and companions, daily quests and a weekly chest                                                                  |
| D     | Leaderboard avatars and last online                                                                                                         |

Rules from earlier phases that hold here:

- Phase 2: "Cosmetics change looks only, never speed, jumps, hearts, damage or score." Companions are cosmetics.
- Phase 2: "Every coin amount on screen (home, shop balance, prices) uses that gold coin sprite, never an emoji."
- Phase 1: "Names on the board come from the server … The client never sends a name." Names stay as they are; D adds looks and a day, never a name.
- Phase 5: "The ghost never collides, collects, hurts or changes anything; it is only drawn." Companions follow the same rule.

## 1. Track A: combat

### 1.1 Boss shield

- "When a boss takes 3 hits within 2 seconds, it raises a shield for 3 seconds."
- "The boss glows for 0.5 seconds before the shield rises (every boss move is telegraphed); hits in that half second still count."
- "While the shield is up, fireballs bounce off it with a clang and do no damage. A ring pulses round the boss."
- "After the shield drops, it can't rise again for 4 seconds."
- "Every boss has the shield: story, boss rush, Starfall Peaks and community-world bosses."
- Triple fire counts each fireball as a hit, so a triple volley at close range raises the shield. That is intended: it rewards spacing shots.

### 1.2 Walkers shoot at medium range

- "Pig, slime, chameleon and beetle keep their close lunge. When the player is in front of them, 52 to 120 px away and within 24 px of their height, they crouch and flash for 0.5 seconds, then fire one projectile toward the player."
- Projectiles: pig mud ball, slime glob (a short arc), chameleon sand spit, beetle pebble. Each has its own look (drawn in code, like the boss projectiles) and sound.
- "Each walker waits 3 seconds between shots."
- "Walkers don't shoot in levels below difficulty 2." Story levels take their difficulty from the generator's level list; the hand-made levels (Grassland 1–3, Iceland 1–2) count as difficulty 1, so their walkers never shoot.
- "A projectile costs a heart, like a seed. A fireball burns it, like a seed."
- "The level generator keeps walkers that can shoot out of range of portal arrivals, as it does for spitters."
- Community-world walkers shoot too; their projectile takes the creature's colours.

### 1.3 Combo meter

- "Each kill or coin within 2 seconds of the previous one adds 1 to the combo. After 2 seconds without one, the combo ends."
- "Score from kills and coins is multiplied: x2 from a combo of 5, x3 from 10, x4 from 20 (the most)."
- "Losing a heart ends the combo. Finishing a level ends it."
- "The combo multiplies score only. Wallet coins stay 1 per coin collected."
- HUD: beside the score, the combo count and multiplier ("12 · x3") with a bar that drains over the 2 seconds; hidden under a combo of 2.
- Sound: each step plays a blip that rises in pitch with the combo; reaching a new multiplier plays a chime.
- "The screen shakes (2 px, 0.2 seconds) when the dino loses a heart, a fall into a pit included, and at no other time." (Changed during the build at the developer's request: the combo no longer shakes the screen.)
- "Settings has a switch "Screen shake", on by default. With it off, nothing shakes."
- Phones buzz on a new multiplier, as they do on hits.
- **Server:** the daily score ceiling becomes "4 × (20 per coin + the highest enemy score per enemy) + 100 per power-up for a heart picked up at full health". The endless ceiling changes the same way. Both live in the shared rules that `pnpm functions:sync` copies to `functions/`.
- Ghost runs are unchanged: they replay movement, not score.

## 2. Track B: mobile and feel

### 2.1 See-through controls and the pause button

- "Touch buttons are drawn at 45% opacity, and 75% while pressed."
- "Settings has "Control opacity": Low (25%, 55% pressed), Medium (45%, 75% pressed) or High (70%, 100% pressed). Medium is the default."
- "The pause button sits at the bottom middle of the screen on every device, inside the safe area (notches and gesture bars), the same size as the other touch buttons."
- "The first-open hint shows above the pause button, never under it."

### 2.2 Help shows this device's controls

- "On a touch device (the same check that shows the touch buttons, `"ontouchstart" in document.documentElement`), Help shows only the touch controls. Everywhere else it shows only the keyboard controls."

### 2.3 Compact home and menus

- "On screens under 500 px tall, buttons, gaps, padding and type on the home screen and in menus are about 25% smaller. Mode cards stay in one row on screens 561 px wide and up, and sit two to a row only below that."
- "Tap targets stay at least 44 px tall to touch. Buttons, tabs and chips may be drawn smaller (about 30 px) with an invisible 44 px touch area; Settings rows stay at least 40 px and text fields at least 38 px." (Changed after the build at the developer's request: the menus looked bigger on a phone, not smaller.)
- "On short screens the padding around screens and inside menus is tight, so the content gets the room."
- Done means: "At 667 × 375 and 844 × 390, everything on the home screen fits without scrolling." Before-and-after screenshots at both sizes go in the PR.
- Screens taller than 500 px look as they do today.

### 2.4 The next level is ready

- "Once a level has loaded, the next level's sprites and music start downloading in the background."
- "Going through the portal shows no loading bar when the next level is already in; otherwise the bar shows as it does today."
- "When the browser asks to save data (`navigator.connection.saveData`), nothing preloads."
- Endless already builds one level ahead; its next level's assets preload the same way. A community world's art is generated in memory and needs no download; its music tracks preload.

### 2.5 Floating platforms in every generated level

**Root cause (found while writing this spec and its plan).** In about 6% of community-world levels (18 of
300 sampled), 3.4% of endless levels and one story level, every placed platform is unreachable.
The reachability check is right; the placement is wrong: `placePlatforms` puts a flat-segment
platform 3 rows (48 px) above the ground 40% of the time, higher than the dino's 44.4 px jump,
and `placeSkyPlatforms` stacks whole tiers on it. The repair drops the root and everything on
it, and each retry replays the same seeded numbers. `buildLevel`'s repair then drops
them all, and `validate` accepts a level with no platforms. Example: the shared world
"Sunny Coral Reef" (`wmwc1eva8px1kub`, seed 889198317), level 1: 6 platforms placed, all 6
dropped.

- First task: no platform is placed higher than the dino can jump to from the surface below it; confirm the cause with a failing test first.
- "A generated level other than a boss arena is valid only with at least 2 rows and at least 10 tiles of floating platforms. A level that falls short is retried with the next seed, like any other invalid level."
- "Boss arenas keep their fixed ledges."
- "Story levels already shipped keep their layouts (best times, stars and ghosts depend on them)." The new placement and the rule apply to levels generated at play time: daily, endless and community worlds. Story levels keep today's placement (`placement: "v1"`), so the committed areas still equal the generator's output.
- Test: the Sunny Coral Reef record's 5 non-boss levels each have floating platforms; a sweep over many seeds and every theme finds no generated level under the rule.

### 2.6 Control sizes and a custom layout

Added after the build at the developer's request.

- "On a touch device the pause button is the same size as the arrow and fire buttons. Without touch it stays 40 px."
- "The fire button sits on the same bottom line as the other touch buttons, not raised above it."
- "Settings → Touch buttons has a "Customize layout" button, shown only on a touch device. It opens a full-screen editor over the game's backdrop that shows the five controls (left, right, fire, jump, pause) where they are now."
- "In the editor each control can be dragged anywhere on screen with a finger. A control always stays fully on screen, inside the safe area (notches and gesture bars)."
- "The editor has three buttons: "Save" keeps the layout, "Reset" puts every control back where it starts, and "Cancel" leaves without changing anything."
- "A saved layout is kept on this device only (screens differ between devices), not in cloud save, and survives a reload. Each control's place is stored as a share of the screen's width and height, so it follows rotation and resizing, and is pulled back on screen if it would fall off."
- "With no saved layout, the controls sit where they do by default."
- "The first-open hint and the touch buttons keep working the same in a custom layout; only their positions change."

## 3. Track C: rewards

### 3.1 Achievements

Twelve more (24 in all). The phase 2 rules hold: "Each achievement unlocks once and pays
its coins once," with the same toast and screen.

| ID                | Name            | How                                                      | Coins |
| ----------------- | --------------- | -------------------------------------------------------- | ----- |
| `world-conqueror` | World Conqueror | Beat all five story world bosses                         | 500   |
| `grand-tour`      | Grand Tour      | Finish every level of the five worlds and Starfall Peaks | 1,000 |
| `combo-king`      | Combo King      | Reach a x4 combo                                         | 250   |
| `unbroken`        | Unbroken        | Reach a combo of 50                                      | 500   |
| `shield-breaker`  | Shield Breaker  | Beat a boss without a fireball bouncing off its shield   | 250   |
| `sharpshooter`    | Sharpshooter    | Burn 100 enemy projectiles in total                      | 250   |
| `egg-hunter`      | Egg Hunter      | Find 10 eggs                                             | 250   |
| `full-nest`       | Full Nest       | Hatch every companion                                    | 500   |
| `questing`        | Questing        | Finish 25 daily quests                                   | 250   |
| `treasure-hunter` | Treasure Hunter | Open 4 weekly chests                                     | 500   |
| `deep-diver`      | Deep Diver      | Reach endless level 25                                   | 250   |
| `devoted`         | Devoted         | Reach a 30-day daily streak                              | 500   |

- "World Conqueror and Grand Tour count progress the player already has. The other new totals count from when phase 6 ships."
- The Achievements screen shows progress where there is a number ("3 / 5 bosses").

### 3.2 Eggs and companions

Eggs:

- "Every non-boss story level of the five worlds has one hidden egg. It can be found once." Starfall Peaks is built like a community world and has no eggs.
- "Each day's daily challenge has one egg in one of its five levels, the same level for everyone that day. It can be found once per day."
- "Endless and community worlds have no eggs."
- "Eggs sit off the main path, on higher platforms. The reachability check covers them, like coins and power-ups."
- Hand-made story levels get their egg placed by hand. Generated story levels get theirs added to the area file by a script, without changing the layout.
- "Finding an egg shows "🥚 Egg found! It hatches in 24 hours." and it goes to the nest."

Hatching:

- "An egg hatches 24 hours after it was found, by the device's clock, whether or not the game is open."
- "The nest shows each egg with the time left ("Hatches in 5h"), or "Ready!"." The Nest card lives in the Quests panel (see 3.3).
- "When the home screen opens and an egg is due, a card shows "Your egg hatched! Meet <name>." with Wear and Later buttons. Several due eggs hatch one after another."
- "An egg hatches into one of 8 companions: 6 common and 2 rare. Each hatch has a 10% chance of a rare one. A companion the player already owns pays 100 coins instead."

Companions:

- Companions are generated pixel art, like the other sprites (`pnpm sprites`).
- "Companions are a fourth shop slot, "Companion". The free item is "None"; companions can't be bought, only hatched."
- "The worn companion follows the dino a few steps behind, along the dino's path. It never collides, collects, hurts or changes anything; it is only drawn."
- "Wearing a companion takes effect in the next level, and on the shop's preview at once" (the phase 2 rule for every slot).

Saving: the nest (eggs with their found and hatch times) and owned companions sync through
cloud save. Eggs merge by ID; owned companions are the union. Phase 2's Reset progress
erases them too.

### 3.3 Daily quests and the weekly chest

Quests:

- "Each local day has three quests. They change at local midnight."
- "One of the three is a mode quest for the unlocked mode the player has played least in the last 7 days (story, daily, endless, community, boss rush). The other two come from the general pool."
- "Each quest comes in easy, medium and hard counts; a day's three quests are one of each, paying 50, 75 and 100 coins."
- "A quest that names an enemy only names one the player has met in a world they have unlocked."
- General pool (medium counts shown): "Defeat 8 slimes with fireballs", "Defeat 15 enemies", "Collect 150 coins", "Finish a level without losing a heart", "Reach a x3 combo", "Burn 5 enemy projectiles", "Pick up 3 power-ups".
- Mode quests: "Finish today's daily challenge", "Reach endless level 5", "Finish a community world level", "Finish a story level", "Finish boss rush".
- "A quest pays its coins once, when it is finished, with a toast "✅ <quest> · +<coins>"."
- "Quests count in every mode except where a quest names its mode."
- The Quests card has three rows with progress bars ("5 / 8") and the coins each pays. It and the Nest card live in a "Quests" panel, opened from a Quests icon in the home footer, right after the Leaderboards icon. The home screen itself shows neither card; the hatch card still shows there.
- The Quests icon carries a badge with the number of today's quests not yet finished (3, 2, 1); with all three done there is no badge. Its label says the count ("Quests, 2 to do"). The badge updates when the home screen shows, when the panel closes, and at local midnight (3 again).
- Changed after the build, at the developer's request: the cards were first on the home screen.

Weekly chest:

- "Each finished quest gives the chest a key. A week runs Monday to Sunday, local time."
- "12 keys in a week open the chest: 500 coins and one egg."
- "Keys reset each Monday. Keys over 12 do nothing."
- The Quests card shows the chest with its keys ("🔑 7 / 12").

Saving: today's quests and their progress, the week's keys, and the counts the mode quest
uses sync through cloud save (counters take the higher value). Quest and chest coins pay
through the wallet's rewards, each under its own ID, so each pays once. Like the rest of
the wallet, they are trusted to the client.

## 4. Track D: leaderboard profiles

### 4.1 Player profile

- "Each player with an account has a profile document `players/{uid}`: `{ skin, hat, companion, seenDay }`."
- "A player writes only their own profile. Firestore rules allow only those four fields, only item IDs that exist, and `seenDay` only as yesterday's, today's or tomorrow's UTC day number from the server's time (`request.time`), so a device clock a day off either way still counts."
- "Nobody reads `players/{uid}` directly: the rules allow no client read or list. Boards get profiles from a Cloud Function `getProfiles` that takes at most 30 uids and returns only `skin`, `hat`, `companion` and `seenDay` for each, never a document's create or update time." (Changed during the build: Firestore exposes every document's create and update times to the microsecond, which would publish the time of day a player played, and an open list would let anyone page through every profile.)
- "A write the rules refuse never blocks the next one: when a profile write is refused, the next write leaves `seenDay` out."
- "The profile is written when the player's worn items change, and when the game opens on a day not yet recorded. A player without an account has no profile."
- "Deleting an account deletes its profile."

### 4.2 Avatars

- "Each row on the daily and endless boards shows the player's dino in their skin and hat, with their companion."
- "A player with no profile shows the classic dino."
- Avatars are drawn once per combination and kept for the session. The board asks `getProfiles` in batches of 30 (two calls for the top 50, plus the pinned row). A failed or offline call caches nothing, so the next board open asks again.
- If profiles fail to load, the board still shows, with classic dinos.

### 4.3 Last online

- "Each row shows when the player was last online: "Today", "Yesterday", "3d ago" (up to 6 days), "1w ago" (7 to 13 days) or "2w+ ago"."
- "Only the day is stored, never a time."
- "Settings has a switch "Show when I was last online", on by default. It belongs to the account and syncs through cloud save, so turning it off on one device turns it off on all of them. Turning it off deletes `seenDay` from the profile, and no device writes `seenDay` until it is on again. Worn items still update the avatar. A row with no `seenDay` shows no status."
- `PRIVACY.md` says what the profile holds, that it is public, and how to hide last online.

### 4.4 Board privacy

Added after the build at the developer's request: the daily and endless board entries (phase 1) were public Firestore documents carrying an `updatedAt` time in milliseconds, and Firestore exposes every document's create and update times, so anyone could read when each improving run happened, whatever "Show when I was last online" says.

- "Nobody reads the daily or endless board documents directly: the rules allow no client read or list of `daily/{seed}/scores` or `endless`."
- "Boards come from Cloud Functions that return, for each entry, only what the board shows: the uid, the name, the score, the time in seconds, and for endless the level reached. Never `updatedAt` or a document's create or update time."
- "A board call returns the top 50 and the caller's own entry (signed in, anonymous included); it never returns another player's entry outside the top 50."
- "The server keeps each board's top 50 for 60 seconds, so polling a board can't time a top player's improvement more finely than that. The caller's own entry is always current." (Added after the security review.)
- "Ranking, the pinned row, the error copy and the offline behaviour stay as phase 1 and the fixes-and-leaderboards spec describe them."

## 5. Analytics

New events, with only these parameters (as before, never a name, email or user ID):

- `combo_best` `{ mode, combo }`, once per level, when the level's best combo is 5 or more
- `egg_found` `{ source }` with source `story` or `daily`
- `egg_hatched` `{ companion, duplicate }`
- `quest_complete` `{ quest }`
- `chest_open` `{}`

## 6. Out of scope

- Push reminders for hatching eggs or quests. Reminders stay at one a day (phase 4).
- Server checks on quest, chest or egg rewards. They are trusted to the client, like the wallet.
- Eggs in endless and community worlds.
- Changing the layouts of story levels already shipped.
- Compacting old quest and egg records in cloud save. They grow about 25 KB a year; cloud save's 100 KB limit is some 3–4 years away.

## 7. Testing

Each track's plan writes the tests its changes need, in `tests/` with `node:test`, as earlier phases did. In particular:

- A: the shield rises at 3 hits in 2 seconds and not at 2, ignores hits while up and keeps its cooldown; walkers shoot only in the 52–120 px band at difficulty 2 and up; combo steps, multipliers and resets; the new score ceiling accepts a perfect x4 run and refuses one point more.
- B: the platform rule over every theme and many seeds, plus the Sunny Coral Reef record; Help picks one set of controls; the next area's assets are requested once its level has loaded.
- C: each new achievement's check; hatch timing at 23h59 and 24h; the duplicate payout; quests change at local midnight and the mode quest picks the least-played unlocked mode; chest keys reset on Monday; cloud-save merges of eggs, companions, quests and keys.
- D: Firestore rules tests for the profile (own doc only, known IDs only, `seenDay` only yesterday, today or tomorrow, no client read or list); `getProfiles` returns only the four fields; last-online labels for each day range; account deletion removes the profile.
