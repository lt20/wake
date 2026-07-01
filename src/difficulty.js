// ============================================================================
// Cable Rush — difficulty curve (pure, zero Phaser).
//
// difficultyForElapsed(elapsedSec) returns the run's current tuning:
//   speedTarget   : tow speed climbs BASE_SPEED → MAX_SPEED over the run
//   gapMin/gapMax : spacing tightens (gapMax shrinks; gapMin stays at the floor)
//   moduleWeights : the spawn mix hardens (more composites/big modules late)
// ============================================================================
import * as C from "./config.js";
import { MODULES } from "./modules.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Reach peak difficulty by the end of the run.
const RAMP = C.RUN_DURATION;

// Per-type weights at the start (easy) and at peak (hard). Composites and big
// modules are rare early and common late; plain singles do the opposite.
const EASY = {
  kicker: 4,
  rail: 4,
  flatBox: 2,
  kickerBig: 1,
  bigSlide: 1,
  downSlide: 0.6,
  kinkRail: 0.6,
  aFrame: 0.5,
  slideToKicker: 0.3,
  kickerToSlide: 0.3,
  doubleKicker: 0.3,
};

const HARD = {
  kicker: 1.5,
  rail: 1.5,
  flatBox: 1.5,
  kickerBig: 2,
  bigSlide: 2,
  downSlide: 1.5,
  kinkRail: 1.5,
  aFrame: 1.5,
  slideToKicker: 2.2,
  kickerToSlide: 2.2,
  doubleKicker: 2,
};

export function difficultyForElapsed(elapsedSec) {
  const p = clamp(elapsedSec / RAMP, 0, 1);

  const speedTarget = Math.min(
    C.MAX_SPEED,
    C.BASE_SPEED + (C.MAX_SPEED - C.BASE_SPEED) * p
  );

  const gapMin = C.SPAWN_GAP_MIN; // floor — never tighter than this
  const gapMax = Math.max(gapMin, lerp(C.SPAWN_GAP_MAX, C.SPAWN_GAP_MIN + 120, p));

  const moduleWeights = {};
  for (const m of MODULES) {
    const e = EASY[m.type] ?? m.weight;
    const h = HARD[m.type] ?? m.weight;
    moduleWeights[m.type] = lerp(e, h, p);
  }

  return { speedTarget, gapMin, gapMax, moduleWeights };
}
