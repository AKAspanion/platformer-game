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
- ↑ or Space: jump (again in the air with Wings)
- Enter or Shift: fire (Enter also starts, resumes, or retries from the menus)
- Esc or P: pause / resume (the game also pauses when the tab is hidden)

On phones and tablets the touch buttons scale with the screen (Settings → Touch buttons),
respect notches and gesture bars, and buzz on hits. The game is landscape-only: the web
manifest and the Android TWA lock the orientation, and a browser in portrait shows a
"turn your phone" prompt.

## Gameplay

- **3 hearts.** Enemies, seeds and spike traps cost a heart (with a short knockback and
  blink); falling in a pit costs a heart and puts you back on the last safe ground.
- **One fireball, one kill.** Beetles are armoured and take two.
- **Enemies:** pig, slime, chameleon and beetle walk and lunge at you when you get close
  (they crouch and flash first); bats swoop at you from above; spitter plants shoot seeds
  (a fireball burns a seed).
- **Power-ups:** heart (+1), shield (blocks one hit), triple fire (15s), wings (double
  jump, 20s).

## Worlds and levels

Five worlds of six levels each (30 in all): Grasslands, Iceland, Desert, Graveyard and
Factory. **Level 6 of every world is a boss battle** with an HP bar, and each boss fights
its own way, harder world by world (more health, quicker wind-ups, shorter breaks, chained
attacks in a final phase):

| Boss           | Health | Attacks                                                              |
| -------------- | ------ | -------------------------------------------------------------------- |
| King Pig       | 12     | charge, stomp (rolling seeds), summons piglets                       |
| Frost Slime    | 16     | triple bounce, icicle rain on marked spots, splits when hurt         |
| Sand Chameleon | 20     | vanishes and reappears behind you, tongue lash, sand fan, charge     |
| Bat Lord       | 24     | swoop dives, rings of sonic orbs, bat swarm                          |
| Mecha Beetle   | 28     | rocket charge that bounces back, missile barrage, floor laser, quake |

Every attack is telegraphed (a "!", a tremble or crouch, ground marks or a red line). Both
arena gates shut when the fight starts and lift when the boss falls. Beating the Factory
boss finishes the campaign.

**Unlocking:** the level select only opens a level once you have walked into it in the
campaign. Play continues from the last level you reached. On localhost (or with `?debug`) every
level is open for testing; Settings has a developer switch to turn that off, and only real
progress is saved.

**Stars:** each level has three, shown on its card in the level select: all coins, all
enemies (or the boss), and finishing under the target time. A level counts as finished
when you leave it through its exit; each star, once earned, is kept, along with your best
time.

Grassland 1–3 and Iceland 1–2 are hand-made; the rest come from the level generator (PCG)
in `app/pcg/generator.js`, which the game also runs in the browser. Story levels are
written to `app/areas` with

```bash
yarn levels
```

which also renders the level-select thumbnails (`scripts/generate-thumbnails.py`).
Every level is checked for reachability with the player's jump physics (entry to exit and
back, every coin and power-up) before it is used. Ground stays low, like Grassland 1–2,
and the space above is filled with tiers of floating platforms.

## Premium modes

Behind the premium flag (`app/util/premium.js`; unlock locally with `?premium=1` or the
developer switch in Settings on localhost):

- **Daily challenge:** 5 generated levels from today's date, the same for everyone.
- **Endless:** generated forever, one level ahead, getting harder.
- **Create a world:** describe a world in words; Claude Haiku 5.5 turns it into a small
  world spec and the generator builds the levels. See [server/README.md](server/README.md)
  for the tiny API server (it holds the API key). Without a server the game uses an
  offline keyword parser.

Build flags: `PREMIUM=1` (premium on by default, for test builds) and `WORLD_API_URL=...`.

## Sprites

The bat, beetle, spitter plant, attack poses, power-up icons and 8-frame death
animations are generated pixel art (Python 3 with Pillow):

```bash
yarn sprites
```

## Music and sound

Each world plays its own track (`grasslands`, `iceland`, `desert`, `dungeon` for the
Graveyard, `lab` for the Factory). Boss arenas switch to a battle theme per boss
(`boss-<kind>.mp3`); after the win a fanfare plays and the world's track comes back.
Enemies have their own attack and death sounds, and every boss move, roar, projectile and
gate has a sound. The boss music and sound effects are synthesized chiptune made by
`yarn audio` (`scripts/generate-audio.py`, needs ffmpeg for the MP3s).

## Tests

`yarn test` runs headless tests (esbuild + `node:test`): combat, hearts and pits,
power-ups, enemy attacks and the new enemies, Dino animation states, level integrity for
every story level (spawns, portals, footing, coins), the generator across all themes and
difficulties, daily/endless/custom modes, the world creator, and a random-input fuzz run
on every level.

Open the game with `?debug` (e.g. `http://localhost:2108/?debug`) to get `window.debugGame`
in the console for poking at the running game.

## Author

Ankit Kumar Pandit
