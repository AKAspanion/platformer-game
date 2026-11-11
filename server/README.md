# World server (prompt-to-world + shared worlds)

The server behind the premium **Worlds** screen. It does two jobs:

1. **Designs worlds.** The player describes a world; Claude turns the description into a
   JSON _world spec_ (palette, terrain, backdrop, decor, 2-4 creature designs, a boss and its
   moves, music mood). The game paints the art, composes the music and builds the 6 levels
   from it in the browser, so the model never draws tiles and every level stays playable.
2. **Shares worlds.** Every world players publish is stored here and pushed live to every
   game connected to the server (Server-Sent Events).

| Endpoint                   | What                                                      |
| -------------------------- | --------------------------------------------------------- |
| `POST /api/world`          | `{ prompt }` -> `{ spec }` (Claude)                       |
| `GET /api/worlds?limit=60` | newest shared worlds                                      |
| `GET /api/worlds/:id`      | one world                                                 |
| `POST /api/worlds`         | `{ world }` with `Authorization: Bearer <token>`: publish |
| `GET /api/worlds/stream`   | SSE, one `world` event per newly published world          |

Published worlds are validated with the game's own `sanitizeWorld`
(`app/worlds/spec.js`), and the author is taken from the token, not from the request.

## Model

`claude-haiku-5-5` by default ($0.10 / $0.50 per million input / output tokens): it fills a
structured schema from one sentence at `effort: "low"`; a world costs well under a tenth of
a cent. For more inventive designs set `WORLD_MODEL=claude-opus-5-5` (about 40x the cost,
still around a cent per world). The request uses structured outputs (`output_config.format`,
validated with Zod), then the game's `normalizeWorldSpec` clamps it again.

## Run it

```bash
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # http://localhost:8787
```

Then in the game, open **Settings → World creator server** and enter `http://localhost:8787`
(or build with `WORLD_API_URL=... yarn build`). Without a server the game designs worlds
offline and keeps them on the device.

| Env                   | Default                                              |
| --------------------- | ---------------------------------------------------- |
| `PORT`                | `8787`                                               |
| `ALLOWED_ORIGINS`     | `https://akaspanion.github.io,http://localhost:2108` |
| `RATE_LIMIT_PER_HOUR` | `30` designs per IP (publishing: 20 per user)        |
| `WORLD_MODEL`         | `claude-haiku-5-5`                                   |
| `DATA_FILE`           | `server/data/worlds.json`                            |
| `AUTH_MODE`           | `mock`                                               |

The server imports `app/worlds/spec.js`, so deploy it together with the `app/` folder (or
copy that one file next to it). Keep the API key in the host's secret store.

## Auth: mock today, Firebase next

`AUTH_MODE=mock` accepts the game's unsigned `mock.<base64url json>` tokens, so anyone can
publish as anyone: fine for testing, not for a public launch. For Firebase:

- game: replace the mock in `app/auth/index.js` with Firebase Auth (same method names);
  `getIdToken()` then returns the Firebase ID token.
- server: in `verifyToken` (`worlds-store.mjs`) verify it with
  `firebase-admin`'s `auth().verifyIdToken()` and run with `AUTH_MODE=firebase`.
- storage: the JSON file is fine for one server; a Firestore `worlds` collection (with an
  `onSnapshot` listener in the game) can replace both the file and the SSE stream.

Premium is still checked only in the game; once Play Billing is in, verify the purchase on
the server too. Shared worlds only show names and taglines written by the AI or the offline
designer, never a player's raw prompt; the `called "..."` name a player can ask for is the
one piece of player text that is shared, so add moderation before a public launch.
