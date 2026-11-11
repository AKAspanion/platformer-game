# World creator functions

Cloud Functions for Dino's Adventure's world creator (https://dino.spanion.in), in
`asia-south1` next to the Firestore database (project `dinos-adventure`).

| Function       | Call                      | Does                                                                                                                                                                                 |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `designWorld`  | `{ prompt }` → `{ spec }` | Claude turns the player's description into a world spec (structured output), normalized with the game's `normalizeWorldSpec`. 30 per user per hour.                                  |
| `publishWorld` | `{ world }` → `{ world }` | Validates the world with the game's `sanitizeWorld`, stamps the author (uid + display name from the ID token, never the email) and time, writes `worlds/{id}`. 20 per user per hour. |

Both are callable functions: the Firebase SDK in the game sends the signed-in player's
ID token, and both refuse signed-out calls. Players read `worlds` straight from
Firestore; `firestore.rules` lets anyone read and no client write. Rate limits are
kept in `limits/{uid}` (functions only).

- `index.js`: Firebase wiring (callables, Firestore, the secret)
- `src/handlers.js`: the logic, no Firebase imports (tested in `tests/functions.test.js`)
- `src/designer.js`: the Claude call, schema and system prompt
- `shared/spec.js`: a copy of `app/worlds/spec.js`, made by
  `node scripts/sync-functions-shared.js` (runs before every functions deploy; CI fails
  if the copy is stale). Don't edit it by hand.

## Configuration

- `ANTHROPIC_API_KEY` (secret): `firebase functions:secrets:set ANTHROPIC_API_KEY`
- `WORLD_MODEL` (optional, `functions/.env`): defaults to `claude-haiku-5-5`, the
  cheapest; `claude-opus-5-5` gives more inventive worlds for about a cent each.
- `APP_CHECK_ENFORCE` (`functions/.env`, committed): `false` = monitor, `true` = callables
  refuse requests without a valid App Check token. See "App Check" below.

## Who can do what

| Action                         | Needs                                                   |
| ------------------------------ | ------------------------------------------------------- |
| Design or publish a world      | a real account (not anonymous); email accounts verified |
| Like a world                   | a real account (not anonymous); email accounts verified |
| Play counts, daily and endless | any account, anonymous included                         |
| Rank a daily or endless run    | a run ticket from `startRun`, issued when the run began |
| Search worlds                  | any signed-in account                                   |

Likes decide the world of the week, which is why throwaway anonymous accounts can't give
them.

**Run tickets** (`src/runs.js`): a ranked daily or endless run starts with `startRun`,
which stores `runs/{ticket}` (account, mode, seed, start time; closed to clients, deleted
by a TTL policy on `expireAt` after three days). The server picks endless seeds. Submitting
a score uses the ticket up, and a run can't claim more time than really passed since the
ticket (5% + 5 s of slack), so a script can't post a score the moment it starts. A run
started offline plays but isn't ranked. Deleting an account also deletes its likes and its play markers
(`worldStats/*/seen/*`, which carry a `uid` and expire by a TTL policy on `expireAt`
three days after the play).

## Run locally

From the repo root: `pnpm emulators`, then `pnpm dev` and open
`http://localhost:2108/?emulators=1`. For the AI designer, put
`ANTHROPIC_API_KEY=...` in `functions/.secret.local` (git-ignored).

## Deploy

CI deploys on every push to `master`. By hand, from the repo root:

```bash
firebase deploy --only functions
```

### One-time setup

1. Set the Anthropic key (then deploy `designWorld`):
   `firebase functions:secrets:set ANTHROPIC_API_KEY`
2. Turn on Google sign-in: Firebase console → Authentication → Sign-in method →
   Google → Enable. Email/password is enabled from `firebase.json` (`firebase deploy --only auth`).
3. Give the CI service account (`github-action-334735458@…`, its key is the
   `FIREBASE_SERVICE_ACCOUNT_DINOS_ADVENTURE` GitHub secret) the roles to deploy
   functions and rules, as a project owner:

   ```bash
   for role in cloudfunctions.admin run.admin iam.serviceAccountUser \
     artifactregistry.admin cloudbuild.builds.editor secretmanager.viewer \
     firebaserules.admin datastore.indexAdmin firebaseextensions.viewer \
     serviceusage.serviceUsageViewer; do
     gcloud projects add-iam-policy-binding dinos-adventure --condition=None \
       --member=serviceAccount:github-action-334735458@dinos-adventure.iam.gserviceaccount.com \
       --role=roles/$role
   done
   ```

4. Scheduled functions (`pickWorldOfWeek` every Monday, `sendReminders` every hour)
   run on Cloud Scheduler. Once, as a project owner, enable its API and let the CI
   account create the jobs (it can only view APIs, not enable them):

   ```bash
   gcloud services enable cloudscheduler.googleapis.com --project dinos-adventure
   gcloud projects add-iam-policy-binding dinos-adventure --condition=None \
     --member=serviceAccount:github-action-334735458@dinos-adventure.iam.gserviceaccount.com \
     --role=roles/cloudscheduler.admin
   ```

   The next deploy creates the jobs in `asia-south1`. Check them in the Cloud console
   → Cloud Scheduler, and use Force run to send a test pass.

## App Check

App Check makes the callables accept only calls from the real game (reCAPTCHA Enterprise
in the browser), so scripts can't farm throwaway accounts against them. Roll it out in
three steps; each one is safe on its own:

1. **Register the web app** (project owner, once):
   - Google Cloud console → Security → reCAPTCHA → Create key: type **Website**, domains
     `dino.spanion.in`, `dinos-adventure.web.app`, `dinos-adventure.firebaseapp.com`
     (and `localhost` if you want App Check locally without a debug token). Leave "Use
     checkbox challenge" off.
   - Firebase console → App Check → Apps → the web app → **reCAPTCHA Enterprise** → paste
     the key's ID → Save. Leave the APIs' enforcement **off** there.
2. **Ship the client**: add `FIREBASE_APPCHECK_SITE_KEY=<key id>` to `.env` and to the
   `APP_ENV` secret (`gh secret set APP_ENV < .env`), then deploy. The game now sends
   tokens; the functions only log calls that arrive without one ("call without App
   Check" in Cloud Logging).
3. **Enforce**: once those logs are rare (old cached clients update within a day or two),
   set `APP_CHECK_ENFORCE=true` in `functions/.env` and deploy. Requests without a valid
   token then get `unauthenticated`.

Locally: either list `localhost` on the reCAPTCHA key, or create a debug token (Firebase
console → App Check → Apps → ⋮ → Manage debug tokens) and put it in `.env` as
`FIREBASE_APPCHECK_DEBUG_TOKEN`. Production builds drop it (`webpack.config.js`), and the
game only uses it on localhost. The emulators don't check App Check, so `?emulators=1`
needs neither.

Firestore reads from the game (worlds, boards, stats) are not covered by this: turning on
App Check enforcement for Cloud Firestore in the Firebase console would cover them too,
but only after step 2 has been live for a while.
