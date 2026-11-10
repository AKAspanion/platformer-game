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

## Author

Ankit Kumar Pandit
