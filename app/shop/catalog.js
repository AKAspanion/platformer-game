/**
 * The shop's catalogue: three slots, one free item each (owned and worn from
 * the start). Cosmetics change looks only, never speed, jumps, hearts, damage
 * or score.
 */
export const CATALOG = {
  skin: [
    { id: "classic", name: "Classic", price: 0 },
    { id: "mint", name: "Mint", price: 200 },
    { id: "sunset", name: "Sunset", price: 300 },
    { id: "midnight", name: "Midnight", price: 500 },
    { id: "ghost", name: "Ghost", price: 750 },
    { id: "gold", name: "Gold", price: 1000 },
  ],
  hat: [
    { id: "none", name: "No hat", price: 0 },
    { id: "cap", name: "Cap", price: 150 },
    { id: "party", name: "Party hat", price: 200 },
    { id: "viking", name: "Viking", price: 400 },
    { id: "wizard", name: "Wizard", price: 500 },
    { id: "crown", name: "Crown", price: 600 },
  ],
  fireball: [
    { id: "classic", name: "Classic", price: 0 },
    { id: "blue", name: "Blue flame", price: 250 },
    { id: "green", name: "Green flame", price: 250 },
    { id: "purple", name: "Purple flame", price: 400 },
  ],
};

export const SLOTS = Object.keys(CATALOG);

/** The item of each slot that is owned and worn from the start. */
export const FREE = { skin: "classic", hat: "none", fireball: "classic" };

export function itemOf(slot, id) {
  const items = Object.prototype.hasOwnProperty.call(CATALOG, slot) ? CATALOG[slot] : [];
  return items.find((item) => item.id === id) || null;
}
