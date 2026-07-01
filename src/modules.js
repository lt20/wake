// ============================================================================
// Cable Rush — declarative module catalogue (pure, zero Phaser).
//
// A "module" is a placeable obstacle the rider traverses, built from one or
// more ordered SEGMENTS positioned by `offset` within the module footprint.
// Each segment is spawned as its own interactive piece, so composites reuse the
// existing per-piece physics (a ride-up = kicker, a grind = rail/slide):
//   - slide→kicker : grind then a kicker lip → grind, then pop.
//   - kicker→slide : a kicker then a long rail in the landing zone → pop, then grind.
//
// Segment kinds:
//   ride-up : triangular kicker face climbed to a lip (rests on the water)
//   grind   : flat slide/box surface `surfaceDrop` px above the water
//   decor   : non-interactive cosmetic piece (e.g. an A-frame's back face)
// ============================================================================
import * as C from "./config.js";

const rideUp = (texture, offset, width, rise) => ({
  kind: "ride-up",
  texture,
  offset,
  width,
  origin: { x: 0, y: 1 },
  rise,
  height: rise + 12,
});

const grind = (texture, offset, width, opts = {}) => ({
  kind: "grind",
  texture,
  offset,
  width,
  origin: { x: 0, y: 0 },
  height: opts.height ?? 70,
  surfaceDrop: opts.surfaceDrop ?? 64,
  imageYOffset: opts.imageYOffset ?? 8,
  slopeDrop: opts.slopeDrop ?? 0,
  bow: opts.bow ?? 0,
  color: opts.color ?? null,
});

const decor = (texture, offset, width, height) => ({
  kind: "decor",
  texture,
  offset,
  width,
  origin: { x: 0, y: 0 },
  height,
});

const KW = C.KICKER_WIDTH; // 240
const KR = C.KICKER_RISE; // 122

export const MODULES = [
  // 1. small kicker (original)
  { type: "kicker", weight: 3, depth: 5, segments: [rideUp("kicker", 0, KW, KR)] },

  // 2. big kicker — taller lip
  {
    type: "kickerBig",
    weight: 2,
    depth: 5,
    segments: [rideUp("kickerBig", 0, 280, 168)],
  },

  // 3. standard slide / box (original)
  { type: "rail", weight: 3, depth: 5, segments: [grind("rail", 0, 260)] },

  // 4. big slide — longer + higher
  {
    type: "bigSlide",
    weight: 2,
    depth: 5,
    segments: [grind("railLong", 0, 360, { surfaceDrop: 84 })],
  },

  // 5. slide → kicker (grind, then launched by a lip)
  {
    type: "slideToKicker",
    weight: 1,
    depth: 5,
    segments: [grind("rail", 0, 260), rideUp("kicker", 260, KW, KR)],
  },

  // 6. kicker → slide (pop, then land on a long rail to grind)
  {
    type: "kickerToSlide",
    weight: 1,
    depth: 5,
    segments: [rideUp("kicker", 0, KW, KR), grind("railLong", 280, 360)],
  },

  // 7. A-frame — kicker up + a cosmetic descending back face
  {
    type: "aFrame",
    weight: 1,
    depth: 5,
    segments: [rideUp("kicker", 0, KW, KR), decor("aframeBack", KW, 160, KR)],
  },

  // 8. double kicker — two kickers with a gap between them
  {
    type: "doubleKicker",
    weight: 1,
    depth: 5,
    segments: [rideUp("kicker", 0, KW, KR), rideUp("kicker", 360, KW, KR)],
  },

  // 9. down-slide — descending grind surface
  {
    type: "downSlide",
    weight: 1,
    depth: 5,
    segments: [grind("railDown", 0, 300, { height: 96, surfaceDrop: 76, slopeDrop: 40 })],
  },

  // 10. kink / rainbow rail — bowed grind surface
  {
    type: "kinkRail",
    weight: 1,
    depth: 5,
    segments: [grind("railKink", 0, 300, { height: 84, bow: 26 })],
  },

  // 11. wide flat box — long surface-spin platform
  {
    type: "flatBox",
    weight: 2,
    depth: 5,
    segments: [grind("flatbox", 0, 420, { height: 60, surfaceDrop: 52, color: 0x9aa9b2 })],
  },
];

// Total horizontal span of a module (rightmost segment extent).
export function moduleFootprint(def) {
  return def.segments.reduce((max, s) => Math.max(max, s.offset + s.width), 0);
}

export function getModule(type) {
  return MODULES.find((m) => m.type === type) || null;
}

const REQUIRED = ["type", "weight", "depth", "segments"];

function isValidSegment(s) {
  return (
    s &&
    typeof s === "object" &&
    typeof s.kind === "string" &&
    typeof s.texture === "string" &&
    typeof s.offset === "number" &&
    s.offset >= 0 &&
    typeof s.width === "number" &&
    s.width > 0 &&
    s.origin &&
    typeof s.origin.x === "number" &&
    typeof s.origin.y === "number"
  );
}

// Structural validity check for a catalogue entry.
export function isValidModule(def) {
  if (!def || typeof def !== "object") return false;
  for (const k of REQUIRED) if (!(k in def)) return false;
  if (typeof def.weight !== "number" || def.weight <= 0) return false;
  if (!Array.isArray(def.segments) || def.segments.length === 0) return false;
  return def.segments.every(isValidSegment);
}

// Which segment is active at normalized position t in [0, 1) across the
// footprint, or null when t falls in a gap (e.g. between double kickers).
export function nextSegment(def, t) {
  const x = t * moduleFootprint(def);
  for (const s of def.segments) {
    if (x >= s.offset && x < s.offset + s.width) return s;
  }
  return null;
}

// Weighted pick from the catalogue. `rng` is a function returning [0, 1).
// When `difficulty.moduleWeights` (a type→weight map) is supplied it steers the
// mix; otherwise each module's base `weight` is used.
export function pickModule(rng, difficulty) {
  const weights = difficulty && difficulty.moduleWeights;
  const weightOf = (m) => (weights && m.type in weights ? weights[m.type] : m.weight);

  const total = MODULES.reduce((s, m) => s + weightOf(m), 0);
  let r = rng() * total;
  for (const m of MODULES) {
    r -= weightOf(m);
    if (r < 0) return m;
  }
  return MODULES[MODULES.length - 1];
}
