/**
 * Turns one frame's world output into quest feats. Pure: the shell calls it
 * every frame with the events it is about to drain, the world's feats and the
 * coins the earnings tick found.
 */

/**
 * @param {string[]} events this frame's world.events
 * @param {({type: "kill", enemy: string} | {type: "egg", id: string})[]} worldFeats
 * @param {number} coinsGained from the existing earnings tick
 * @returns {{feats: object[], eggs: string[], burned: number, shieldBounced: boolean}}
 */
export function featsFrom(events, worldFeats, coinsGained) {
  const feats = [];
  const eggs = [];
  (Array.isArray(worldFeats) ? worldFeats : []).forEach((feat) => {
    if (!feat) return;
    if (feat.type === "kill" && typeof feat.enemy === "string") {
      feats.push({ type: "kill", enemy: feat.enemy });
    } else if (feat.type === "egg" && typeof feat.id === "string") eggs.push(feat.id);
  });
  let burned = 0;
  let powerups = 0;
  let shieldBounced = false;
  (Array.isArray(events) ? events : []).forEach((event) => {
    if (event === "burn") burned += 1;
    else if (event === "powerup") powerups += 1;
    else if (event === "shield-bounce") shieldBounced = true;
  });
  for (let i = 0; i < burned; i++) feats.push({ type: "burn" });
  for (let i = 0; i < powerups; i++) feats.push({ type: "powerup" });
  if (Number.isFinite(coinsGained) && coinsGained > 0) feats.push({ type: "coin", n: coinsGained });
  return { feats, eggs, burned, shieldBounced };
}
