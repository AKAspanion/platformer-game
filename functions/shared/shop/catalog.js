// GENERATED from app/shop/catalog.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * The shop's catalogue: four slots, one free item each (always first), every slot sorted by price, cheapest first (owned and worn from
 * the start). Companions cost nothing and can only be hatched. Cosmetics change looks only, never speed, jumps, hearts, damage
 * or score.
 */
export const CATALOG = {
  skin: [
    { id: "classic", name: "Classic", price: 0 },
    { id: "mint", name: "Mint", price: 200 },
    { id: "sunset", name: "Sunset", price: 300 },
    { id: "ocean", name: "Ocean", price: 350 },
    { id: "lava", name: "Lava", price: 400 },
    { id: "midnight", name: "Midnight", price: 500 },
    { id: "candy", name: "Candy", price: 600 },
    { id: "ghost", name: "Ghost", price: 750 },
    { id: "gold", name: "Gold", price: 1000 },
  ],
  hat: [
    { id: "none", name: "No hat", price: 0 },
    { id: "cap", name: "Cap", price: 150 },
    { id: "party", name: "Party hat", price: 200 },
    { id: "cowboy", name: "Cowboy", price: 300 },
    { id: "viking", name: "Viking", price: 400 },
    { id: "tophat", name: "Top hat", price: 450 },
    { id: "wizard", name: "Wizard", price: 500 },
    { id: "pirate", name: "Pirate", price: 550 },
    { id: "crown", name: "Crown", price: 600 },
  ],
  fireball: [
    { id: "classic", name: "Classic", price: 0 },
    { id: "blue", name: "Blue flame", price: 250 },
    { id: "green", name: "Green flame", price: 250 },
    { id: "crimson", name: "Crimson flame", price: 300 },
    { id: "pink", name: "Pink flame", price: 300 },
    { id: "ice", name: "Ice flame", price: 350 },
    { id: "purple", name: "Purple flame", price: 400 },
    { id: "gold", name: "Gold flame", price: 450 },
    { id: "shadow", name: "Shadow flame", price: 600 },
  ],
  companion: [
    { id: "none", name: "None", price: 0 },
    { id: "hatchling", name: "Hatchling", price: 0, hatch: "common" },
    { id: "ptero", name: "Ptero Chick", price: 0, hatch: "common" },
    { id: "trike", name: "Mini Trike", price: 0, hatch: "common" },
    { id: "stego", name: "Tiny Stego", price: 0, hatch: "common" },
    { id: "raptor", name: "Baby Raptor", price: 0, hatch: "common" },
    { id: "ankylo", name: "Little Anky", price: 0, hatch: "common" },
    { id: "golden", name: "Golden Hatchling", price: 0, hatch: "rare" },
    { id: "crystal", name: "Crystal Drake", price: 0, hatch: "rare" },
  ],
};

export const SLOTS = Object.keys(CATALOG);

/** The item of each slot that is owned and worn from the start. */
export const FREE = { skin: "classic", hat: "none", fireball: "classic", companion: "none" };

export function itemOf(slot, id) {
  const items = Object.prototype.hasOwnProperty.call(CATALOG, slot) ? CATALOG[slot] : [];
  return items.find((item) => item.id === id) || null;
}

const hatched = (kind) =>
  CATALOG.companion.filter((item) => item.hatch === kind).map((item) => item.id);

/** The 8 hatchable companions, in catalogue order (Track D's rules list them). */
export const COMPANION_IDS = CATALOG.companion.filter((item) => item.hatch).map((item) => item.id);
export const COMMON_COMPANIONS = hatched("common");
export const RARE_COMPANIONS = hatched("rare");

/** An item that can't be bought: it is only hatched. */
export function isHatchOnly(slot, id) {
  const item = itemOf(slot, id);
  return !!item && !!item.hatch;
}
