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
