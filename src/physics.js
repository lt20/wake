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

// Air-rotation input derived from a touch drag vector. Mirrors the keyboard
// model: a held drag past `minDist` on an axis rotates at ±rotRate and snaps to
// 0 the instant the finger is under the threshold (released). Both axes can be
// non-zero (a diagonal drag flips AND spins), exactly like holding two arrows.
//   dx > 0 → frontside spin (+), dx < 0 → backside (−)
//   dy > 0 → forward flip (+),   dy < 0 → backward (−)
export function airInputFromDrag(dx, dy, minDist, rotRate) {
  const spinVel = Math.abs(dx) >= minDist ? Math.sign(dx) * rotRate : 0;
  const flipVel = Math.abs(dy) >= minDist ? Math.sign(dy) * rotRate : 0;
  return { spinVel, flipVel, rotating: spinVel !== 0 || flipVel !== 0 };
}

// Edge load after one step. On a cable you build energy by holding an edge
// (heelside/toeside) on the approach; that load throws you off the next kicker.
// Rises toward 1 over `loadTime` while edging, bleeds back toward 0 over
// `decayTime` once released (so the load carries a moment past letting go).
export function edgeLoadAfter(prev, dt, edging, loadTime, decayTime) {
  const rate = edging ? 1 / loadTime : -1 / decayTime;
  let v = prev + rate * dt;
  if (v < 0) v = 0;
  if (v > 1) v = 1;
  return v;
}

// Launch velocity for a given edge load: min at no load → max at full load, plus
// a perfect-timing bonus. Replaces the flat-water "ollie" charge on the water.
export function popVelocityFromLoad(load, min, max, perfect, bonus) {
  const l = load < 0 ? 0 : load > 1 ? 1 : load;
  return min + (max - min) * l + (perfect ? bonus : 0);
}

// Name the edge being held. edgeDir < 0 = heelside, > 0 = toeside; a switch
// stance swaps which physical side that is. Null when not edging.
export function edgeName(edgeDir, stance = 0) {
  if (!edgeDir) return null;
  const heel = edgeDir < 0 !== (stance === 1);
  return heel ? "Heelside" : "Toeside";
}

// One ballistic-with-lift air integration step. On the cable the rider hangs on
// the line, so the arc is floatier than free fall: gravity is gentler and the
// fall speed is clamped to a terminal value. `apexLift` (default 0) can add a
// small upward nudge near the apex for a true "hang" plateau. Pure mirror of the
// inline integration so the feel is unit-testable.
export function airStep(y, vy, dt, { gravity, maxFall, apexLift = 0 }) {
  let nvy = vy + gravity * dt;
  if (apexLift > 0 && Math.abs(nvy) < apexLift) nvy -= apexLift * dt;
  if (nvy > maxFall) nvy = maxFall;
  return { y: y + nvy * dt, vy: nvy };
}

// Handle-pass state for a given spin angle. On a real spin you pass the tow
// handle behind your back as you rotate away from the boat/cable and swap it to
// the other hand. Facing away (cos < 0, i.e. 90°–270° of each turn) the handle
// is routed BEHIND the torso; `hand` names which hand holds it (swaps at 180°);
// `passProgress` peaks (1) at the moment the handle is fully behind the back.
export function handlePassState(spinDeg, windowDeg = 40) {
  const norm = (((spinDeg % 360) + 360) % 360);
  const behind = norm > 90 && norm < 270;
  const hand = norm >= 180 ? 1 : 0;
  const to180 = Math.abs(norm - 180);
  const passProgress = windowDeg > 0 ? Math.max(0, 1 - to180 / windowDeg) : 0;
  return { behind, hand, passProgress };
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

// Human-readable trick name, or null when nothing notable happened. The extra
// flags name the signature wakeboard tricks (all optional, so existing callers
// keep the exact same output):
//   raley       → the board kicked out behind (replaces the flip name)
//   edged       → a backroll launched off a loaded edge is a "Tantrum"
//   switchStance→ took off switch (prefix "Switch")
//   landsBlind  → lands riding blind (suffix "to blind")
export function buildTrickName({
  flipDeg,
  spinDeg,
  extras = [],
  raley = false,
  edged = false,
  switchStance = false,
  landsBlind = false,
}) {
  const parts = [];
  const flips = Math.round(Math.abs(flipDeg) / 360);
  if (raley) {
    parts.push("Raley");
  } else if (flips > 0) {
    // a backroll thrown off a hard edge is a Tantrum
    const dir = flipDeg < 0 ? (edged ? "Tantrum" : "Backroll") : "Frontroll";
    parts.push(flips > 1 ? `${dir} x${flips}` : dir);
  }
  const spins = Math.round(Math.abs(spinDeg) / 180) * 180;
  if (spins >= 180) {
    const dir = spinDeg > 0 ? "FS" : "BS";
    parts.push(`${dir} ${spins}`);
  }
  for (const t of extras) parts.push(t);
  if (parts.length === 0) return null;
  let name = parts.join(" + ");
  if (switchStance) name = `Switch ${name}`;
  if (landsBlind) name = `${name} to blind`;
  return name;
}

// Bonus points for the signature moves, on top of the rotation/landing score.
export function signatureBonus({
  raley = false,
  tantrum = false,
  switchStance = false,
  landsBlind = false,
}) {
  return (
    (raley ? C.PTS_RALEY : 0) +
    (tantrum ? C.PTS_TANTRUM : 0) +
    (switchStance ? C.PTS_SWITCH_TAKEOFF : 0) +
    (landsBlind ? C.PTS_BLIND_LAND : 0)
  );
}
