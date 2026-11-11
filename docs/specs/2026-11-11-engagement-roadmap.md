# Engagement Roadmap

**Goal:** more players come back on more days. The game measures it, gives a reason to return
every day, gives progress something to buy and unlock, and grows its community worlds.

**Why this order:** the game tracks nothing today, so analytics ship first so we can measure
everything after. The daily challenge comes next because it is the only mode built around
coming back each day, but it sits behind the premium flag, and premium can't be bought yet
(`app/util/premium.js`). Every later phase builds on the daily loop or on cloud identity.

## 1. Phases

Each phase gets its own plan in `docs/plans/` and ships on its own branch.

| Phase | Ships                                                                                        | Plan                                     |
| ----- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1     | Analytics, free daily challenge, global daily leaderboard, streaks, share card              | `2026-11-11-phase-1-daily-loop.md`       |
| 2     | Cloud save, coin shop (cosmetics), star unlocks (secret world, boss rush), achievements      | `2026-11-11-phase-2-progress-rewards.md` (spec: `docs/specs/2026-11-11-phase-2-progress-rewards.md`) |
| 3     | Community worlds: play counts, likes, trending, featured world, world links, remix, creator notes | `2026-11-11-phase-3-community-worlds.md` (spec: `docs/specs/2026-11-11-phase-3-community-worlds.md`) |
| 4     | Opt-in reminders: web push and iOS push for the daily and for streaks                       | `2026-11-11-phase-4-reminders.md` (spec: `docs/specs/2026-11-11-phase-4-reminders.md`) |
| 5     | Ghost runs of your best time, first-session onboarding                                       | written when phase 4 ships               |

## 2. Phase 1: the daily loop

### 2.1 Analytics

- The game reports to Firebase Analytics (Google Analytics 4) through the `firebase` package it already depends on. No new vendor.
- "Analytics must never delay the game: the analytics code loads after the player's first input, or 3 seconds after start, whichever comes first."
- "Events sent before analytics loads are queued, at most 50; older ones are dropped."
- "If analytics fails to load (offline, blocked), the game plays exactly as before and throws nothing."
- Events and their parameters, nothing else:
  - `app_open` `{ returning, days_since_first }`
  - `mode_start` `{ mode }` with mode one of `story`, `daily`, `endless`, `custom`
  - `level_start` `{ mode, level_id }`
  - `level_complete` `{ mode, level_id, seconds, stars_added }`
  - `level_fail` `{ mode, level_id, seconds }`
  - `daily_complete` `{ score, seconds, rank }`
  - `leaderboard_open` `{}`
  - `share` `{ method }` with method `share` or `copy`
- "Events never carry a name, an email or a user ID."
- Settings has a switch "Share anonymous usage stats", on by default. "With the switch off, the analytics code is never loaded and queued events are dropped."
- "On localhost or with ?debug, events are written to the console and never sent."
- `PRIVACY.md` says what is collected, by whom (Google Analytics), and how to turn it off.

### 2.2 Free daily challenge and endless

- "The daily challenge and endless mode are free for everyone. Only features that use AI stay premium: today, that is the world creator."
- The daily stays as it is: 5 generated levels from the player's local date (`dailySeed`), the same for everyone on that date.

### 2.3 Player identity

- "Players who haven't signed in get an anonymous account the first time they finish a daily run, with no prompt."
- "An anonymous player's leaderboard name is generated from their account ID, for example "Swift Raptor 42", and is the same every time."
- "Signing in with Google or creating an email account while anonymous keeps the same account, so scores stay."
- "Signing in to an email account that already exists switches to that account; the anonymous scores stay under the old name."
- "The world creator still needs a real sign-in: an anonymous player is treated as signed out there."
- "Deleting an account also deletes its leaderboard scores."

### 2.4 Global daily leaderboard

- "Only completed daily runs (all 5 levels) are ranked."
- Ranking: "higher score first; on a tie, the shorter time first."
- "Each player has one entry per day, their best run."
- "The server accepts a run only for yesterday, today or tomorrow by UTC date, so every time zone can submit its local day."
- "The server refuses a score above the most the day's levels can give (20 per coin, plus the highest enemy score per enemy, plus 100 per power-up for a heart picked up at full health), and a time under 30 seconds or over 7200 seconds."
- "A player can submit at most 30 daily runs an hour."
- "Names on the board come from the server: the signed-in display name, or the generated name. The client never sends a name."
- The board shows the top 50 for today, and the player's own row pinned at the bottom when they are outside the top 50.
- Error copy:
  - refused run: "That run can't be ranked."
  - day out of range: "That daily challenge has closed."
  - rate limit: "Too many scores, try again in a minute."
  - the board fails to load: "Leaderboard didn't load." with a Try again button
  - no scores yet: "No scores yet today. Be the first!"
- "If the score can't be sent (offline, server error), the run is kept on the device and sent the next time the home screen opens. The result panel says "You're offline. Your score will be sent later.""

### 2.5 Streaks

- "A day counts toward the streak when the player finishes at least one daily level that day (local date)."
- "Playing again on a day already counted changes nothing."
- "Missing exactly one day uses a streak freeze if the player has one; otherwise the streak starts again at 1."
- "Missing two or more days starts the streak again at 1, whatever the freezes."
- "Players start with 1 freeze, earn 1 more at every 7 days of streak, and hold at most 2."
- The home screen's daily card shows the streak as "🔥 6" when it is 2 or more; the result panel says "🔥 6-day streak!" when it grows.
- "Streaks are kept on this device in phase 1. Cloud save (phase 2) carries them across devices."

### 2.6 Share card

- After a daily run (completed or not), the result panel has a Share button.
- The shared text, for example:

  ```
  Dino's Adventure Daily · 11 Nov 2026
  🟩🟩🟨🟥⬛
  Score 4,320 · 3:41 · #12 of 340
  🔥 6-day streak
  https://dino.spanion.in
  ```

- "Each square is one daily level: 🟩 finished without losing a heart, 🟨 finished after losing one or more, 🟥 lost the run there, ⬛ not reached."
- "The rank part is left out when the run wasn't ranked; the streak line is left out under 2 days."
- "Share uses the device's share sheet when it has one, and copies to the clipboard otherwise, then says "Copied to clipboard"."

## 3. Later phases (planned when phase 1 ships)

- **Phase 2, progress and rewards.** Campaign progress, stars, records, streaks and coins sync to Firestore for signed-in and anonymous players. Coins buy dino skins, hats and fireball colours (looks only, never gameplay). 75 stars open a secret sixth world; beating all five bosses opens boss rush. Achievements such as "beat a boss without a hit".
- **Phase 3, community worlds.** Each world counts plays and likes; a Trending tab ranks by recent plays; one featured world a week. `dino.spanion.in/w/<id>` opens a world, with a preview image for link previews. Remix starts a new world from an existing one's description. Creators see "37 players beat your boss this week".
- **Phase 4, reminders.** Opt-in only, at most one a day: "Today's challenge is up" and "Your 6-day streak ends tonight". Web push for the PWA and the Android app; the iOS app's `PushNotifications.swift` for iOS.
- **Phase 5, polish.** Ghost runs: a see-through copy of your best run on each campaign level. First session: in the first level within 10 seconds of opening; the world creator offered after world 1.
