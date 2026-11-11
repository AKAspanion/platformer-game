# Phase 3: Community Worlds

Part of the engagement roadmap (`docs/specs/2026-11-11-engagement-roadmap.md`, phase 3).
Builds on phase 1 (anonymous accounts, `shareRun`, `track()`) and phase 2 (`stats.finishWorld`).

**Goal:** good worlds get found and played, players have a reason to share them, and creators
see that people play what they made.

## 1. Free community

- "Browsing, searching, playing, liking and sharing community worlds are free. Creating and remixing a world use AI and stay premium."
- "Built-in worlds (the Dino Team's starter worlds and Starfall Peaks) have no counts, no like button and no share link."

## 2. Plays, finishes and likes

- "A play counts when a player starts a community world. Each account counts once per world per day."
- "A finish counts when a player beats the world's boss arena. Each account counts once per world per day."
- "Plays and finishes need an account: a player without one gets a silent anonymous account when they start a community world."
- "Counts are kept by the server; the game never writes them."
- "A like is one per account per world. Pressing ❤ again takes it back."
- "Liking without an account creates a silent anonymous account first."
- "An account can record at most 120 plays and finishes an hour; more are ignored without an error."
- "An account can like or unlike at most 60 times an hour; past that the game says "Slow down a little, try again in a minute.""
- "A world's card shows its plays and likes, for example "▶ 1.2k · ❤ 37", with numbers of 1,000 or more shortened to one decimal and "k"."
- "The ❤ button is filled when the player has liked the world."

## 3. Trending

- "The Community tab has two lists, Trending (the default) and New."
- "Trending ranks worlds by recent plays: each play counts half as much for every 3 days that pass."
- "Trending shows the top 30. New shows the newest first, as the Community tab does today."
- "A world with no plays yet appears only in New."

## 4. Featured world

- "Every Monday at 00:00 UTC a scheduled function picks the world of the week: among worlds with at least 20 plays in the last 14 days, the one with the most likes per play in those 14 days. On a tie, more plays wins, then the newer world."
- "The world featured last week can't be picked again the next week."
- "If `config/featured` has a `worldId` set by hand in the Firestore console, that world is featured instead, until the field is cleared."
- "The featured world shows as a banner at the top of the Community tab: "★ World of the week: <name> by <author>" with a Play button."
- "With no featured world (no world qualifies and none is pinned), there is no banner."

## 5. Share links

- "Every community world has a Share button that shares `https://dino.spanion.in/w/<id>` through the share sheet, or copies it and says "Link copied"."
- "Opening a world link loads the game with that world's card open in the Community tab, ready to play."
- "If the world no longer exists, the game opens the Community tab and says "That world doesn't exist anymore.""
- "Link previews in chats and social posts show the title "<name> · Dino's Adventure", the description "<tagline> A world by <author>. Play it free in your browser.", and the world's thumbnail."
- "The thumbnail is the world card's picture, drawn by the game when the world is published: a PNG of 480x270 pixels, at most 100 KB. A larger one is not kept."
- "A world published without a thumbnail uses the game's icon in link previews."
- "A link to a world that doesn't exist answers 404 with a page that links to the game."

## 6. Remix

- "A community world's card has Remix (premium). It opens Create with the description filled in as "A remix of <name>: <tagline>", which the player can edit."
- "A remixed world remembers the world it came from, and its card says "Remix of <name>"."

## 7. Creator notes

- "My worlds shows each published world's last 7 days: "120 plays · 37 beat the boss · 15 ❤ this week"."
- "Once a week, when the game opens and the player's worlds had any plays in the last 7 days, a toast says "🎉 Your worlds: 120 plays and 37 boss wins this week"."

## 8. Analytics

New events, with only these parameters:

- `world_like` `{ liked }` (true for a like, false for taking it back)
- `world_share` `{ method }` (`share` or `copy`)
- `world_remix` `{}`
- `world_link_open` `{ found }`
