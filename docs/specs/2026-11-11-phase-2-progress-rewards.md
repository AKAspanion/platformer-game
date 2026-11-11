# Phase 2: Progress and Rewards

Part of the engagement roadmap (`docs/specs/2026-11-11-engagement-roadmap.md`, phase 2). It
builds on phase 1: the anonymous accounts, the rules synced to `functions/shared/`, and
`track()` from `app/analytics/index.js`.

**Goal:** progress is never lost, coins are worth something, and players who finish the
campaign still have goals to chase.

## 1. Cloud save

- "Progress is saved to the player's account: campaign progress (levels reached, stars, best times), mode records, the high score, the daily streak, the wallet, owned and worn cosmetics, achievements and lifetime stats."
- "Settings, the premium flag and unsent daily runs stay on the device."
- "Cloud save runs only for a player who already has an account, anonymous or signed in. It never creates an account and never loads Firebase before the player's first input."
- "Each account has one save document, `saves/{uid}`, which only that account can read or write."
- "A save is at most 100 KB; a larger one is not sent, and the game keeps playing from the device copy."
- "Progress is merged, never overwritten: levels reached are the union, stars per level are combined, the best time per level is the lower, each record and the high score are the higher, achievements are the union with the earliest date, owned cosmetics are the union, coins and lifetime stats are counted per device and summed, the streak with the later day wins (on the same day, the longer one), and worn cosmetics come from the save changed last."
- "The game pulls and merges the account's save when it starts with an account, right after signing in, and right after an anonymous account is created."
- "After any change, the save is sent 5 seconds later (changes in those 5 seconds go together), and when the page is hidden."
- "If a save can't be sent (offline, server error), the device copy stays and the next change or start sends it. The game never shows an error for it."
- "Signing in to an existing account merges this device's progress into that account."
- "Signing out keeps the progress on this device."
- "Deleting an account also deletes its save."
- Settings shows the save state under the account row: "Progress saved to your account" once a save has been sent, "Progress saved on this device" with no account.

## 2. Wallet and shop

- "Every coin collected in any mode adds 1 coin to the wallet, at once. Dying or quitting never takes coins back."
- "Each device counts the coins it earned under its own random device ID, so two devices never overwrite each other's coins."
- "The balance is coins earned, plus achievement rewards, minus the prices of the items owned."
- "If purchases made on two devices merge into a balance below 0, the balance shows 0, every item stays owned, and new coins pay off the difference first."
- "Cosmetics change looks only: no item changes speed, jumps, hearts, damage or score."
- The catalogue (id, name, price in coins):

  | Slot      | Items                                                                                                                  |
  | --------- | ---------------------------------------------------------------------------------------------------------------------- |
  | Skin      | `classic` Classic 0 · `mint` Mint 200 · `sunset` Sunset 300 · `midnight` Midnight 500 · `ghost` Ghost 750 · `gold` Gold 1000 |
  | Hat       | `none` No hat 0 · `cap` Cap 150 · `party` Party hat 200 · `viking` Viking 400 · `wizard` Wizard 500 · `crown` Crown 600 |
  | Fireball  | `classic` Classic 0 · `blue` Blue flame 250 · `green` Green flame 250 · `purple` Purple flame 400                      |

- "The free item of each slot is owned from the start and worn by default."
- "One item is worn per slot. Wearing an item takes effect in the next level, and on the shop's preview at once."
- "Buying needs a balance at least the item's price. Otherwise the Buy button reads "Need N more" and does nothing."
- "Skins and fireball colours are palette shifts of the existing sprites, made when the game loads. Hats are pixel sprites drawn on the dino's head, made by `scripts/generate-sprites.py`."
- "The look shows wherever the dino plays: campaign, daily, endless, worlds, the secret world and boss rush."
- The home screen shows the balance as "🪙 1,240" beside a Shop button.

## 3. Secret world

- "Collecting 75 of the campaign's 90 stars opens a secret sixth world, Starfall Peaks."
- "Starfall Peaks is built into the game: 5 levels and a boss arena made from a fixed world spec, with no AI and no network."
- "It plays like a shared world (its own tiles, music, enemies and boss), and its best score is kept as a record."
- Until it opens, the level select shows a locked card: "Starfall Peaks · ★ 75 to open (you have N)".

## 4. Boss rush

- "Beating all five campaign bosses opens Boss Rush: the five boss arenas, in campaign order, back to back."
- "A boss counts as beaten once its level has been finished."
- "Boss rush starts with 3 hearts, carries hearts from fight to fight, and gives back one heart (up to 3) after each boss."
- "Losing all hearts ends the run; there is no checkpoint."
- "The best time for a finished boss rush is kept as a record, and shown as "Best 4:12"."
- Until it opens, it shows as a locked card: "Boss Rush · beat all 5 bosses to open (N/5)".

## 5. Achievements

- "Each achievement unlocks once and pays its coins once."
- The list (id, name, how, coins):

  | id               | Name            | How                                                          | Coins |
  | ---------------- | --------------- | ------------------------------------------------------------ | ----- |
  | `first-steps`    | First Steps     | Finish Grassland 1                                           | 50    |
  | `coin-collector` | Coin Collector  | Collect 1,000 coins in total                                 | 100   |
  | `big-spender`    | Big Spender     | Buy your first item                                          | 50    |
  | `exterminator`   | Exterminator    | Defeat 500 enemies in total                                  | 250   |
  | `untouchable`    | Untouchable     | Beat a campaign boss without losing a heart                  | 250   |
  | `speedy`         | Speedy          | Earn the time star on every level of one world               | 250   |
  | `daily-habit`    | Daily Habit     | Reach a 7-day daily streak                                   | 250   |
  | `star-seeker`    | Star Seeker     | Collect 75 stars                                             | 250   |
  | `completionist`  | Completionist   | Collect all 90 stars                                         | 500   |
  | `peak-performer` | Peak Performer  | Beat the Starfall Peaks boss                                 | 500   |
  | `rush-hour`      | Rush Hour       | Finish boss rush                                             | 500   |
  | `world-traveller`| World Traveller | Finish 3 different community worlds                          | 250   |

- "Totals count from when phase 2 ships; the stars and streak achievements count the stars and streak the player already has."
- "When an achievement unlocks, a toast shows for 3 seconds: "🏆 <name> · +<coins> coins". Several at once show one after another."
- An Achievements screen, opened from the home screen, lists all 12: unlocked ones with their date, locked ones with progress where it has a number ("640 / 1,000").

## 6. Analytics

New events, with only these parameters:

- `shop_buy` `{ item, price }` (item as `slot:id`, for example `hat:crown`)
- `achievement` `{ id }`
- `secret_world_start` `{}`
- `boss_rush_start` `{}`
- `boss_rush_complete` `{ seconds }`
