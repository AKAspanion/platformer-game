# Dino's Adventure

Dino's Adventure is a platformer game made with a pixel art style.<br />
Goal of this game is to help Dino collect coins and defeat enemies on his way.<br /><br />
Game is made entirly using `Vanilla JS`, `HTML5 Canvas`, and
`CSS`.
<br />
Game is also mobile responsive and can be installed on mobile/desktop as a PWA.<br /><br />

![Dino's Adventure](https://github.com/AKAspanion/platformer-game/blob/master/demo.gif?raw=true)

## Live

The game is live [here](https://akaspanion.github.io/platformer-game/).

## Locally

Clone the repo and run

```bash
npm run install
npm run serve
```

Game will launch at `http://localhost:2108/`

## Controls

- ← / → or A / D: move
- ↑ or Space: jump
- Enter or Shift: fire (Enter also starts, resumes, or retries the area from the menu)
- Esc or P: pause / resume (the game also pauses when the tab is hidden)

## Generated levels

Areas 9–16 (Grassland 4–5, Iceland 3–4, Desert 1–4) are produced by a seeded level
generator. Desert levels use spike pits and spike traps instead of water.
Edit the `LEVELS` config in `scripts/generate-levels.js` and run

```bash
yarn levels
```

to regenerate them. Each level is checked for reachability with the player's jump
physics before it is written.

Like Grassland 1–2, generated ground stays low (rows 8–10, mostly 9–10, at most 29% of
the screen solid) and the space above is filled with tiers of floating platforms with
coins and patrolling enemies. After regenerating, refresh the level-select thumbnails:

```bash
python3 scripts/generate-thumbnails.py
```

## Enemy death animations

The 8-frame enemy death animations in `app/assets/sprites/enemies/*/dead/` are generated
from each enemy's first walk frame (needs Python 3 with Pillow):

```bash
yarn sprites
```

## Tests

Headless tests for combat (one fireball = one kill, walls, death animation, hit-stop),
level integrity (spawns, portals, enemy footing, coin placement, generated levels up to
date) and a random-input fuzz run on every level:

```bash
yarn test
```

Open the game with `?debug` (e.g. `http://localhost:2108/?debug`) to get `window.debugGame`
in the console for poking at the running game.

## Author

Ankit Kumar Pandit
