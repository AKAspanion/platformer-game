import areas from "../areas";
import { FINISH } from "../pcg/generator";
import { LEVELS } from "../util/index";

/**
 * Boss rush: the five campaign boss arenas, in campaign order, back to back.
 * It starts with 3 hearts, carries hearts from fight to fight and gives back
 * one after each boss (up to 3). Losing all hearts ends the run: there is no
 * checkpoint. Copies of the arenas live at BOSS_RUSH_BASE + i.
 */
export const BOSS_RUSH_BASE = 5000;
export const MAX_HEARTS = 3;

// Boss arenas are entered at the same height as every generated level.
const ENTRY = { x: 16, y: 9 * 16 - 8 };

export const bossLevels = (levels = LEVELS) => levels.filter((level) => level.boss);

const heartsAfterBoss = (hearts) => Math.min(MAX_HEARTS, hearts + 1);

export function createBossRushSession(levels = LEVELS) {
  const bosses = bossLevels(levels);
  Object.keys(areas)
    .map(Number)
    .filter((id) => id >= BOSS_RUSH_BASE && id < BOSS_RUSH_BASE + 1000)
    .forEach((id) => delete areas[id]);

  bosses.forEach((level, i) => {
    const copy = JSON.parse(JSON.stringify(areas[level.id]));
    const last = i === bosses.length - 1;
    copy.id = BOSS_RUSH_BASE + i;
    copy.portals = copy.portals.map((portal) =>
      portal.direction < 0
        ? { ...portal, destinationArea: null, destinationX: 0, destinationY: 0 }
        : {
            ...portal,
            destinationArea: last ? FINISH : BOSS_RUSH_BASE + i + 1,
            destinationX: ENTRY.x,
            destinationY: last ? 0 : ENTRY.y,
          },
    );
    areas[copy.id] = copy;
  });

  return {
    kind: "bossrush",
    key: "best",
    startId: BOSS_RUSH_BASE,
    left: 24,
    top: 9 * 16 - 20,
    label: (id) => `Boss Rush ${id - BOSS_RUSH_BASE + 1}/${bosses.length}`,
    ensure: () => {},
    heartsAfterBoss,
  };
}
