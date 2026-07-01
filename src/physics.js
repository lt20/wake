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

// The ONLY path to a wipeout: an air→water landing, either while still holding a
// grab or with the board too far from upright. Surface spins (RIDE/GRIND) never
// route through here, so spinning on the ground can never wipe out.
export function wipesOutOnWaterLanding(grabbing, flipErr, spinErr, flipTol, spinTol) {
  if (grabbing) return true;
  return !isCleanLanding(flipErr, spinErr, flipTol, spinTol);
}

// Points banked for a span of surface-spin degrees: one award per completed 180.
export function surfaceSpinPoints(spinDeg) {
  return Math.floor(Math.abs(spinDeg) / 180) * C.PTS_SURFACE_SPIN_PER_180;
}

// Map the direction held during the air to a grab name. dirX > 0 is toward the
// nose (forward), dirY < 0 is up. A neutral / ambiguous hold defaults to Indy.
//   neutral / down  → Indy
//   forward / back  → Nose / Tail
//   pure up         → Method
//   up + back/fwd   → Stalefish / Mute
export function grabName(dirX, dirY) {
  const ax = Math.abs(dirX);
  const ay = Math.abs(dirY);
  if (ax === 0 && ay === 0) return "Indy";
  if (ay > ax) {
    if (dirY < 0) {
      if (ax === 0) return "Method";
      return dirX < 0 ? "Stalefish" : "Mute";
    }
    return "Indy"; // down hold = standard Indy
  }
  return dirX > 0 ? "Nose" : "Tail";
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
