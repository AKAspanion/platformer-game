# World API (prompt-to-world)

A tiny server behind the premium **Create World** screen. The player describes a world;
Claude turns the description into a small JSON _world spec_ (theme, levels, difficulty,
enemy kinds, hazards, power-ups) and the game's own level generator (`app/pcg`) builds the
levels from it in the browser. The model never draws tiles, so every level stays playable.

## Model: Claude Haiku 5.5

`claude-haiku-5-5` is the cheapest Claude model ($0.10 / $0.50 per million input / output
tokens) and is plenty for this: it fills in a 9-field schema from one sentence. Each world is
roughly 600 input + 150 output tokens, so about **$0.0001 per world** (10,000 worlds ≈ $1).
The request uses structured outputs (`output_config.format`, validated with Zod) at
`effort: "low"`. Bigger models would cost 20-40x more for no visible gain.

## Run it

```bash
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # http://localhost:8787/api/world
```

Then in the game, open **Settings → World creator server** and enter
`http://localhost:8787/api/world` (or build with `WORLD_API_URL=... yarn build`).
Without a server the creator falls back to an offline keyword parser.

| Env                   | Default                                              |
| --------------------- | ---------------------------------------------------- |
| `PORT`                | `8787`                                               |
| `ALLOWED_ORIGINS`     | `https://akaspanion.github.io,http://localhost:2108` |
| `RATE_LIMIT_PER_HOUR` | `30` requests per IP                                 |

Deploy it anywhere that runs Node 20+ (Cloud Run, Fly.io, Render, a VPS). Keep the API key in
the host's secret store. Note the premium check is client-side today: once Play Billing is in,
verify the purchase token here before calling Claude.
