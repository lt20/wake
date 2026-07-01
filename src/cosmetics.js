// ============================================================================
// Cable Rush — cosmetic catalogue (pure, zero Phaser). Riders, boards and spots
// the player can unlock with coins. A rider/board is mostly a tint (or, later, a
// texture-atlas skin); a spot overrides the run's colour mood + palette accents.
// Kept declarative and pure like modules.js so it is unit-testable.
// ============================================================================

export const RIDERS = [
  { id: "default", name: "Classic", cost: 0, tint: null },
  { id: "sunset", name: "Sunset", cost: 800, tint: 0xffa24d },
  { id: "neon", name: "Neon", cost: 1600, tint: 0x33d6c8 },
  { id: "shadow", name: "Shadow", cost: 3000, tint: 0x6d7c86 },
];

export const BOARDS = [
  { id: "default", name: "Park", cost: 0, tint: null },
  { id: "carbon", name: "Carbon", cost: 1000, tint: 0x2b2b2b },
  { id: "gold", name: "Gold", cost: 2500, tint: 0xffd23f },
];

// A spot picks the ambience mood applied by GameScene (see MOODS there).
export const SPOTS = [
  { id: "lake", name: "Home Lake", cost: 0, mood: "midday" },
  { id: "golden", name: "Golden Hour", cost: 1500, mood: "golden" },
  { id: "dusk", name: "Dusk Session", cost: 3200, mood: "dusk" },
];

const GROUPS = { riders: RIDERS, boards: BOARDS, spots: SPOTS };

export function catalog(kind) {
  return GROUPS[kind] || [];
}

export function itemOf(kind, id) {
  return catalog(kind).find((i) => i.id === id) || null;
}

export function costOf(kind, id) {
  const it = itemOf(kind, id);
  return it ? it.cost : 0;
}

export function isUnlocked(profile, kind, id) {
  const list = profile && profile.unlocked && profile.unlocked[kind];
  return Array.isArray(list) && list.includes(id);
}

// Attempt to buy an item: returns { ok, profile, reason }. Pure — returns a NEW
// profile on success (does not mutate the input), so callers stay predictable.
export function purchase(profile, kind, id) {
  const item = itemOf(kind, id);
  if (!item) return { ok: false, profile, reason: "unknown" };
  if (isUnlocked(profile, kind, id)) return { ok: false, profile, reason: "owned" };
  if ((profile.coins || 0) < item.cost) return { ok: false, profile, reason: "poor" };
  const next = {
    ...profile,
    coins: profile.coins - item.cost,
    unlocked: {
      ...profile.unlocked,
      [kind]: [...(profile.unlocked[kind] || []), id],
    },
  };
  return { ok: true, profile: next, reason: "bought" };
}
