# Security

## Reporting a vulnerability

Please report security problems privately through GitHub's
[private vulnerability reporting](https://github.com/AKAspanion/platformer-game/security/advisories/new),
not in a public issue. Include what you found, how to reproduce it and what it affects.
You can expect a first answer within a week.

## What protects the game

- **Firestore rules** (`firestore.rules`): every collection is closed to client writes
  except a player's own cloud save; leaderboards, worlds, likes and reminders are written
  only by the Cloud Functions after their own checks.
- **Cloud Functions** (`functions/`): callables check the caller's ID token (anonymous
  players can't use the AI designer, publish or like), validate every input with the
  game's own rules (`functions/shared`, kept identical by CI) and rate limit per account.
- **Run tickets**: daily and endless scores only rank with a single-use ticket issued when
  the run started (the server picks endless seeds), and never claim more time than really
  passed. Scores are still checked against what the levels can give; they are not replayed.
- **App Check** (reCAPTCHA Enterprise): the game sends a token with every call; the
  callables log calls without one, or refuse them once `APP_CHECK_ENFORCE=true`
  (`functions/README.md` has the rollout).
- **Secrets**: the Anthropic key is a Firebase function secret (Secret Manager). The web
  app's Firebase config is read from `.env` at build time (git-ignored; CI writes it from
  the `APP_ENV` secret). Those web values identify the project and ship in every build;
  restrict the browser API key to the game's domains in Google Cloud console.
- **Hosting headers** (`firebase.json`): `nosniff`, a strict referrer policy and
  `frame-ancestors 'self'` against clickjacking.
- **CI** (`.github/workflows/`): `pnpm audit` on both dependency trees, CodeQL, a gitleaks
  scan of the history, dependency review on pull requests and weekly Dependabot updates.
