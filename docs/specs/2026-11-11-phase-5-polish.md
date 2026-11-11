# Phase 5: Ghost Runs and First-Session Onboarding

Part of the engagement roadmap (`docs/specs/2026-11-11-engagement-roadmap.md`, phase 5).
Builds on phases 1–4 (campaign best times and stars, Settings switches, the phase 2
reset, the phase 3 Community tab, `track()`).

**Goal:** give players a rival to beat on every level they've finished, and get new players
playing within seconds, then point them at community worlds once they know the game.

## 1. Ghost runs

- "Each campaign level keeps a ghost of the player's fastest finish on this device: a see-through copy of the dino replaying that run."
- "A finish saves a new ghost only when it is the level's first finish on this device, or faster than the ghost already kept."
- "The ghost starts when the level starts and moves exactly as the kept run did, by the level's clock. When the kept run reached the exit, the ghost disappears."
- "The ghost is drawn at 35% opacity, behind the player, in the classic look (no skin, no hat), facing and animating as the run did."
- "The ghost never collides, collects, hurts or changes anything; it is only drawn."
- "After a death or a restart, the ghost follows the level's clock, so it restarts with the level."
- "Ghosts exist only on campaign levels, boss levels included; not in the daily challenge, endless, community worlds, Starfall Peaks or boss rush."
- "Ghosts are kept on this device only and are not part of cloud save."
- "A ghost records the dino's position 15 times a second. A run longer than 4 minutes keeps no ghost."
- "Settings has a switch "Show ghost", on by default. Off hides ghosts but still keeps new ones."
- "Reset progress also erases every ghost."

## 2. First open

- "The very first time the game opens on a device with no campaign progress (nothing reached beyond Grassland 1 and no stars), it skips the home screen once and starts Grassland 1 as soon as loading finishes."
- "Target: Grassland 1 is playable within 10 seconds of opening the page on a typical connection."
- "During that first run, a controls hint shows at the top of the screen: on a keyboard "← → move · ↑ or Space jump · Enter fire", on a touch screen "Use the buttons to move, jump and fire"."
- "The hint fades out once the player has moved and jumped, or after 15 seconds, whichever comes first, and never shows again."
- "Every later open shows the home screen, as today."

## 3. After world 1

- "The first time a player beats Grassland 6 (the world 1 boss), a card appears once: title "You beat World 1!", text "Play worlds made by other players, or make your own.", with buttons "Play community worlds", "Make my own" and "Later"."
- ""Play community worlds" opens the Community tab (free). "Make my own" opens Create, which asks for premium as it does today. "Later" closes the card."
- "The card never shows again, whichever button is pressed."

## 4. Analytics

New events, with only these parameters:

- `onboarding_start` `{}`
- `onboarding_hint_done` `{ seconds, reason }` (`reason` is `played` or `timeout`)
- `ghost_saved` `{ level_id, seconds }`
- `world1_offer` `{ choice }` (`community`, `create` or `later`)
