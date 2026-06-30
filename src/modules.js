// ============================================================================
// Cable Rush — declarative module catalogue (pure, zero Phaser).
//
// A "module" is a placeable obstacle the rider traverses. It is built from one
// or more ordered SEGMENTS (ride-up, grind, lip, flat...). The two original
// modules (kicker, rail) are re-expressed here as single-segment defs with no
// behaviour change; composites (T6) chain multiple segments.
//
// Segment kinds used by the scene:
//   ride-up : triangular kicker face the rider climbs to a lip (rests on water)
//   grind   : flat slide/box surface `surfaceDrop` px above the water
// ============================================================================
import * as C from "./config.js";

export const MODULES = [
  {
    type: "kicker",
    texture: "kicker",
    weight: 2,
    origin: { x: 0, y: 1 },
    depth: 5,
    segments: [
      {
        kind: "ride-up",
        width: C.KICKER_WIDTH,
        rise: C.KICKER_RISE,
        height: C.KICKER_RISE + 12,
      },
    ],
  },
  {
    type: "rail",
    texture: "rail",
    weight: 1,
    origin: { x: 0, y: 0 },
    depth: 5,
    segments: [
      { kind: "grind", width: 260, height: 70, surfaceDrop: 64, imageYOffset: 8 },
    ],
  },
];

// Total horizontal span of a module (sum of its segment widths).
export function moduleFootprint(def) {
  return def.segments.reduce((sum, s) => sum + s.width, 0);
}

export function getModule(type) {
  return MODULES.find((m) => m.type === type) || null;
}

const REQUIRED = ["type", "texture", "weight", "origin", "depth", "segments"];

// Structural validity check for a catalogue entry.
export function isValidModule(def) {
  if (!def || typeof def !== "object") return false;
  for (const k of REQUIRED) if (!(k in def)) return false;
  if (typeof def.weight !== "number" || def.weight <= 0) return false;
  if (!Array.isArray(def.segments) || def.segments.length === 0) return false;
  return def.segments.every(
    (s) => s && typeof s.kind === "string" && typeof s.width === "number" && s.width > 0
  );
}

// Weighted pick from the catalogue. `rng` is a function returning [0, 1).
// `difficulty` is accepted for forward-compat (T7 will steer the mix) but the
// base weights are used until then.
export function pickModule(rng, difficulty) {
  const total = MODULES.reduce((s, m) => s + m.weight, 0);
  let r = rng() * total;
  for (const m of MODULES) {
    r -= m.weight;
    if (r < 0) return m;
  }
  return MODULES[MODULES.length - 1];
}
