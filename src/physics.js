// ============================================================================
// Cable Rush — pure trick physics & scoring (zero Phaser).
// Extracted verbatim from GameScene so the same logic can be unit-tested and
// reused. Behaviour is identical to the original inline implementation.
// ============================================================================
import * as C from "./config.js";

// Rotation error from the nearest "upright" landing.
//   flipErr: degrees away from an upright multiple of 360 (0 = upright).
//   spinErr: degrees away from a clean multiple of 180 (board square to travel).
export function landingError(flipDeg, spinDeg) {
  const flipErr = Math.abs((((flipDeg % 360) + 540) % 360) - 180);
  const spinErr = Math.abs((((spinDeg % 180) + 270) % 180) - 90);
  return { flipErr, spinErr };
}

// Clean (non-wipeout) landing when both rotations are within tolerance.
export function isCleanLanding(flipErr, spinErr, flipTol, spinTol) {
  return flipErr <= flipTol && spinErr <= spinTol;
}

// Number of completed rotations: a flip = 360, a spin = 180.
export function countRotations(flipDeg, spinDeg) {
  return {
    flips: Math.round(Math.abs(flipDeg) / 360),
    spins: Math.round(Math.abs(spinDeg) / 180),
  };
}

// Points awarded on a clean landing: rotation value + landing bonus, scaled by
// the current combo multiplier.
export function scoreLanding({ flips, spins, pending, multiplier }) {
  const total =
    pending + flips * C.PTS_PER_FLIP + spins * C.PTS_PER_SPIN + C.PTS_PERFECT_LAND;
  return Math.round(total * multiplier);
}

// Human-readable trick name, or null when nothing notable happened.
export function buildTrickName({ flipDeg, spinDeg, extras = [] }) {
  const parts = [];
  const flips = Math.round(Math.abs(flipDeg) / 360);
  if (flips > 0) {
    const dir = flipDeg < 0 ? "Backroll" : "Frontroll";
    parts.push(flips > 1 ? `${dir} x${flips}` : dir);
  }
  const spins = Math.round(Math.abs(spinDeg) / 180) * 180;
  if (spins >= 180) {
    const dir = spinDeg > 0 ? "FS" : "BS";
    parts.push(`${dir} ${spins}`);
  }
  for (const t of extras) parts.push(t);
  return parts.length === 0 ? null : parts.join(" + ");
}
