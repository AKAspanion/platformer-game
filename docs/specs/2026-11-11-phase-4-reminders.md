# Phase 4: Reminders

Part of the engagement roadmap (`docs/specs/2026-11-11-engagement-roadmap.md`, phase 4).
Builds on phase 1 (the daily challenge, streaks, anonymous accounts, `track()`), phase 2
(cloud save, which carries the streak to the server) and phase 3.

**Goal:** players who want it get one nudge a day to come back, at a sensible time, and never
more.

## 1. Who gets reminders

- "Reminders are opt-in. Nobody gets one without turning them on."
- "After a player's first daily run (the first time the daily result panel shows, finished or not), the game asks once: "Remind me when tomorrow's levels are ready?" with "Remind me" and "Not now"."
- ""Not now" is never asked again. The switch in Settings stays available."
- "The browser's or phone's own permission dialog appears only after the player presses "Remind me" or turns the switch on, never when the game loads."
- "Turning reminders on creates the silent anonymous account if the player has none."
- "An account keeps reminders for at most 5 devices; adding a sixth drops the oldest."

## 2. What and when

- "At most one reminder a day, sent at 18:00 in the player's own time zone."
- "If the player already played today's daily challenge (finished at least one daily level, by their local date), no reminder is sent that day."
- "Otherwise, if their streak is 2 days or more and still alive, the reminder says: title "Dino's Adventure", body "Your <N>-day streak ends tonight. Play today's challenge to keep it.""
- "Otherwise it says: title "Dino's Adventure", body "Today's challenge is up. 5 new levels are waiting.""
- "Whether the player played today and their streak come from their cloud save. A player with no cloud save yet gets the "Today's challenge is up" reminder."
- "The time zone is the device's own (an IANA name such as "Asia/Kolkata"), saved when reminders are turned on and each time the game opens with them on, so daylight saving and travel are followed."
- "Tapping a reminder opens the game. On the web and in the Android app it opens `/?from=reminder`."

## 3. Platforms

- "On the web and in the Android app (which shows web notifications through Chrome), reminders use web push through Firebase Cloud Messaging."
- "In the iPhone app, reminders use the app's existing push bridge (`push-permission-request`, `push-token`); the iPhone app itself is not changed."
- "Web push needs the project's Web Push certificate key (VAPID), set in `app/firebase/config.js`. While it is empty, the web switch says "Reminders aren't available in this browser." and nothing is sent."
- "Firebase Messaging loads only when the player turns reminders on, or when the game opens with them already on."

## 4. Settings

- "Settings has a switch "Daily reminder at 18:00"."
- "If the browser or phone has blocked notifications for the game, the switch is off and disabled, with "Notifications are blocked in your browser settings.""
- "If the browser can't do push at all, the switch is off and disabled, with "Reminders aren't available in this browser.""
- "If turning reminders on fails (offline, server error), the switch goes back to off and the game says "Couldn't turn on reminders. Try again later.""
- "Turning the switch off removes this device; the account's other devices keep their reminders."

## 5. Server

- "Reminders are stored per account in `pushSubs/{uid}` and written only by a function; the game never writes them directly."
- "An account can change its reminder settings at most 30 times an hour; past that the game says "Couldn't turn on reminders. Try again later.""
- "A device that Firebase Cloud Messaging reports as no longer registered is removed."
- "Deleting an account also deletes its reminders."

## 6. Analytics

New events, with only these parameters:

- `reminder_prompt` `{ answer }` (`yes` or `no`)
- `reminder_toggle` `{ on }`
- `reminder_open` `{}`
