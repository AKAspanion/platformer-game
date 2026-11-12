# Running Dino's Adventure from the Firebase console

How to manage players, Premium, leaderboards and shared worlds by hand, without code. Everything
here happens in the Firebase console for the project **`dinos-adventure`**:
<https://console.firebase.google.com/project/dinos-adventure>.

The game never lets a player write any of this, so the console (or a Cloud Function) is the only
way to change it. Two jobs the console can't do (marking an email as verified and renaming an
account) need one `gcloud` command each; they are in [Things the console can't do](#things-the-console-cant-do).

Contents:

- [Find a player](#find-a-player)
- [Premium](#premium)
- [Accounts: verify, reset, disable, delete](#accounts-verify-reset-disable-delete)
- [Leaderboards](#leaderboards)
- [Shared worlds](#shared-worlds)
- [World of the week](#world-of-the-week)
- [Reminders and rate limits](#reminders-and-rate-limits)
- [Things the console can't do](#things-the-console-cant-do)
- [Where data lives](#where-data-lives)

## Find a player

Almost everything is keyed by the player's **User UID**.

- **By email:** **Authentication** → **Users** → search the email → copy the **User UID**.
- **By leaderboard name** (anonymous players have no email; the board shows a generated name such
  as "Swift Raptor 42"): **Firestore Database** → collection `endless` → **Filter** → `name` ==
  `Swift Raptor 42`. The document ID is the UID. For a daily board, open
  `daily` → the day (`YYYYMMDD`, UTC, e.g. `20261112`) → `scores` and filter the same way.
- **By world:** a shared world's document in `worlds` has `author.uid`.

## Premium

A player has Premium **only** when the Firestore document `entitlements/{uid}` has the field
`premium` of type **boolean** set to `true`. A string `"true"` or the number `1` is not Premium.
The game reads it after sign-in, and the `designWorld` function (the only one that calls the AI)
checks it before doing anything, so without it no one can design or remix worlds.

**Give Premium**

1. [Find the player](#find-a-player). They must be signed in with Google or email: an anonymous
   account can't design worlds.
2. **Firestore Database** → collection `entitlements` (the first time: **Start collection**,
   Collection ID `entitlements`).
3. **Add document** → **Document ID**: paste the UID (don't use Auto-ID).
4. Field `premium`, type **boolean**, value **true** → **Save**.

The player has it the next time they open the game or sign in.

**Take Premium away:** open `entitlements/{uid}` and set `premium` to `false`, or delete the
document. The game drops it the next time it starts or the player signs in; the server refuses
new AI requests at once.

**See who has Premium:** `entitlements` → **Filter** → `premium` == `true`.

Deleting an account deletes its `entitlements` document too.

## Accounts: verify, reset, disable, delete

All in **Authentication** → **Users**, on the player's row (the ⋮ menu at the end).

| To                          | Do                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Send a password reset email | ⋮ → **Reset password**. Only for email accounts.                                                                                                                                                                                                                   |
| Re-send the verify email    | Not in the console. The player signs in and taps **Resend** on the game's verify-your-email screen.                                                                                                                                                                |
| Mark an email as verified   | Not in the console: [see below](#mark-an-email-as-verified).                                                                                                                                                                                                       |
| Block a player              | ⋮ → **Disable account**. They can't sign in or get new tokens; an open session stops working within an hour. **Enable account** undoes it. Their scores and worlds stay; remove those separately ([Leaderboards](#leaderboards), [Shared worlds](#shared-worlds)). |
| Delete an account           | See below. Don't use ⋮ → **Delete account** on its own.                                                                                                                                                                                                            |

### Delete an account (a deletion request)

The best way is in the game: the player signs in and uses **Settings → Delete account**, which
deletes everything listed on <https://dino.spanion.in/delete-account> at once.

When a player emails a request instead (they can't use the game, or play anonymously), delete
by hand, in this order, with their UID. **Authentication → Delete account** removes only the
sign-in; their data stays in Firestore unless you delete it too.

1. **Their shared worlds**: in `worlds`, filter `author.uid` == UID. For each, edit the `author`
   map: set `uid` to an empty string and `name` to `Anonymous` (the worlds stay public, credited
   to no one). Or delete the world: see [Remove a world](#remove-a-world).
2. **Leaderboards**: delete `endless/{uid}`, and `daily/{day}/scores/{uid}` for each day they
   played (filter `uid` == UID in each day's `scores`).
3. **Their own documents**, each with Document ID = UID: `saves`, `players`, `entitlements`,
   `pushSubs`, `limits`.
4. **Their records in shared collections**: in `worldLikes` and `runs`, filter `uid` == UID and
   delete the matches. (Play markers in `worldStats/{world}/seen` hold a `uid` too, and expire on
   their own three days after the play.)
5. **Authentication** → their row → ⋮ → **Delete account**.

Reply to the request when it's done (the page promises within 30 days).

## Leaderboards

The boards show the top 50 from `daily/{day}/scores` (one per UTC day, `YYYYMMDD`) and `endless`.
Each document's ID is the player's UID, with `uid`, `name`, `score`, `seconds` (and `level` and
`seed` for endless). Changes show on the boards within a minute (the server keeps each board for
60 seconds).

- **Remove a score** (cheating, a bad name): delete the player's document in that board. They
  can post a new score with their next ranked run.
- **Change a name on the board**: edit the `name` field of their score documents. Their next
  best run writes the name from their account again, so for an offensive account name also
  [rename the account](#rename-an-account) or [disable it](#accounts-verify-reset-disable-delete).
- **Keep a cheater off the boards**: disable the account in Authentication, then delete their
  scores.

## Shared worlds

Every shared world is `worlds/{id}` (public: anyone can read it). Its card image is
`thumbs/{id}`, its play and like counts are `worldStats/{id}` with `days` and `seen`
subcollections, and likes are `worldLikes/{id}_{uid}`.

The Dino Team's own worlds (IDs starting `starter-`, and the hidden Starfall world) are part of
the game: don't delete them.

### Remove a world

1. **Firestore Database** → `worlds` → the world → ⋮ → **Delete document**.
2. Delete `thumbs/{id}` and `worldStats/{id}` (and its `days` and `seen` subcollections) the same
   way. Its `worldLikes` (filter `worldId` == id) can go too.

It disappears from the game's lists at once; search can still show it for up to two minutes. A
link to it (`/w/{id}`) then shows "Its maker may have removed it, or the link is broken."

### Edit a world

Open `worlds/{id}` and edit a field, such as `name` or `tagline`. Keep the types as they are: the
game checks every world it loads and skips one it can't read.

## World of the week

The game shows the world in `config/featured`, field `current`. The `pickWorldOfWeek` job
replaces it every Monday 00:00 UTC with the busiest recent world, unless one is pinned.

- **Feature a world now and keep it:** open `config` → `featured` (create it the first time),
  set `worldId` (string) to the world's ID to pin it, and `current` (string) to the same ID to
  show it straight away.
- **Go back to automatic:** delete the `worldId` field. The next Monday's pick chooses again.
- **Run the pick now:** Google Cloud console → **Cloud Scheduler** (region `asia-south1`) → the
  job named `firebase-schedule-pickWorldOfWeek-…` → **Force run**.

## Reminders and rate limits

- **Stop reminders for a player:** delete `pushSubs/{uid}`. They start again if the player
  switches reminders on in the game. Reminders go out once a day, in the player's 6 pm hour
  (their own time zone), from the hourly `firebase-schedule-sendReminders-…` job in Cloud
  Scheduler; **Force run** there sends only to players for whom it's that hour and who haven't
  had one today.
- **Lift a player's rate limits** (such as 30 designs or 20 publishes an hour; plays, likes,
  scores and runs have their own): delete `limits/{uid}`.

## Things the console can't do

These need the Google Cloud CLI (`gcloud`), signed in as a project owner (`gcloud auth list`;
`gcloud auth login` if not). Run them in a terminal and replace `PASTE_UID_HERE`. In `zsh`, don't
name the variable `UID`: it's taken.

### Mark an email as verified

For a player whose verify email never arrives. Designing worlds needs a verified email.

```bash
USER_ID=PASTE_UID_HERE; curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/dinos-adventure/accounts:update" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: dinos-adventure" -H "Content-Type: application/json" -d "{\"localId\":\"$USER_ID\",\"emailVerified\":true}"
```

The answer includes `"emailVerified": true`. The player then signs out and in again (or waits up
to an hour) for the game to see it.

### Rename an account

The name on new scores and worlds comes from the account's display name.

```bash
USER_ID=PASTE_UID_HERE; curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/dinos-adventure/accounts:update" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: dinos-adventure" -H "Content-Type: application/json" -d "{\"localId\":\"$USER_ID\",\"displayName\":\"New Name\"}"
```

Names already on boards and worlds don't change: edit those documents' `name` fields too.

### Settings that need a deploy

These live in the repository, not the console; change them and merge (CI deploys):

- **App Check enforcement** for the functions: `APP_CHECK_ENFORCE` in `functions/.env`
  (`functions/README.md`, "App Check").
- **The AI model:** `WORLD_MODEL` in `functions/.env`.
- **The Anthropic key:** `firebase functions:secrets:set ANTHROPIC_API_KEY`, then deploy.

## Where data lives

| Collection                      | Document ID       | Holds                                                      | Players can    |
| ------------------------------- | ----------------- | ---------------------------------------------------------- | -------------- |
| `entitlements`                  | UID               | `premium` (boolean)                                        | read their own |
| `saves`                         | UID               | progress, coins, looks, settings that sync                 | read/write own |
| `players`                       | UID               | public profile: worn looks, last day seen                  | write own      |
| `daily/{day}/scores`            | UID               | daily board entry                                          | nothing        |
| `endless`                       | UID               | endless board entry                                        | nothing        |
| `worlds`                        | world ID          | shared worlds, `author { uid, name }`                      | read           |
| `thumbs`                        | world ID          | world card images                                          | nothing        |
| `worldStats` (+ `days`, `seen`) | world ID          | plays, finishes, likes, trend                              | read           |
| `worldLikes`                    | `{worldId}_{uid}` | one like                                                   | read their own |
| `config`                        | `featured`        | world of the week: `current`, `lastWeek`, pinned `worldId` | read           |
| `pushSubs`                      | UID               | reminder devices (push tokens) and time zone               | nothing        |
| `runs`                          | ticket            | run checks for ranked runs (deleted after three days)      | nothing        |
| `limits`                        | UID               | rate-limit timestamps                                      | nothing        |

"Players can" is what `firestore.rules` allows from the game; everything else is the functions'
or yours, from the console.
