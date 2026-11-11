# Fixes and Leaderboards

Fixes the developer reported on 11 Nov 2026, plus a Leaderboards screen with a new global endless board.
Builds on phases 1–3 (`feat/community-worlds`, PR #9).

## 1. Leaderboards screen

- "A trophy button next to Settings on the home screen opens Leaderboards."
- "Leaderboards has two global tabs: Daily (today's daily challenge) and Endless."
- "Each tab shows the top 50 and the player's own row pinned at the bottom when they are outside the top 50, as the daily board does today."
- "With no scores, a tab says "No scores yet. Be the first!". If it can't load, it says "Leaderboard didn't load." with Try again."
- "The daily-complete panel keeps the rank line ("#12 of 340") but no longer has a Leaderboard button."

## 2. Endless leaderboard

- "An endless run is ranked when it ends (game over) after reaching level 2 or higher."
- "Each player has one entry, their best run ever: the highest level reached; on a tie, the higher score; then the shorter time."
- "The server checks the run against its seed: the level must be from 2 to 500, the score at most the most levels 1 to <level> of that seed can give (the same 20 per coin, highest enemy score per enemy and 100 per power-up rule as the daily), and the time at least 8 seconds per level cleared and at most 36,000 seconds."
- "A player can submit at most 30 endless runs an hour."
- "Names come from the server, as on the daily board."
- Error copy: refused run "That run can't be ranked."; rate limit "Too many scores, try again in a minute."
- "If the run can't be sent, it is kept on the device and sent the next time the home screen opens, like the daily."
- "The endless game-over panel shows the run's rank: "#12 of 340 all time"."
- "Deleting an account also deletes its endless entry."

## 3. Error messages

- "No player ever sees an error code: no message contains "internal", a number in brackets such as "[0]", or a Firebase code such as "functions/…"."
- "Every error shown to a player goes through one function that turns errors into player-facing copy; anything it doesn't recognise becomes "Something went wrong. Try again.""
- "When searching all worlds fails, the status line says "Couldn't search all worlds, showing loaded ones · <n> worlds"."

## 4. Delete account

- "Opening the game with `?account=delete` opens the delete-account flow. A player who isn't signed in signs in first, then lands in the flow."
- "The flow asks the player to type DELETE (exactly, in capitals). The Delete button stays disabled until they have."
- "A failed delete says what went wrong in player-facing copy (§3) and keeps the account."
- "After the delete succeeds, the `?account=delete` part is removed from the address."

## 5. Music

- "Background music starts only after the level's assets have finished loading."

## 6. Reachable platforms

- "Every platform in every level can be stood on by the dino from the level's start, using only its normal jump (no wings, no power-ups)."
- "This holds for campaign levels, daily and endless levels, community worlds, the starter worlds and Starfall Peaks."
- "A generated level with a platform the dino can't reach is fixed before it is used: the platform is removed, or a step is added below it."

## 7. Lazy loading

- "The home screen downloads only what it shows. It downloads no level music, no sound effects, and no enemy or boss sprites."
- "A level downloads its own theme music, the sprites of the enemies and boss in it, and each sound effect the first time it plays."
- "Assets already downloaded are not downloaded again while the game stays open."
- "Starting a level shows the loading bar until that level's assets are in, as today."

## 8. Production invoker permission (developer action)

- "The developer grants `roles/run.invoker` to `allUsers` on every function's Cloud Run service; the plan changes nothing in production."
- "After each deploy, CI calls every callable function without signing in and fails if any answers 403, so a lost invoker permission is caught at once."
