// ============================================================================
// Cable Rush — global tuning constants
// One place to tweak the feel of the whole game.
// ============================================================================

export const VIRTUAL_WIDTH = 1280;
export const VIRTUAL_HEIGHT = 720;

// World / rider --------------------------------------------------------------
export const RIDER_SCREEN_X = 380; // rider stays fixed here; world scrolls past
export const WATER_Y = 540; // y of the water surface (ride line)
export const BASE_SPEED = 360; // px/s scroll speed (the cable tow speed)
export const MAX_SPEED = 560;
export const MIN_SPEED = 220;
export const SPEED_RECOVER = 60; // px/s per second back toward base after a bail
export const RUN_DURATION = 90; // seconds per time-attack run, then Game Over

// Air physics ----------------------------------------------------------------
export const GRAVITY = 2400; // px/s^2
export const POP_VELOCITY = 720; // base launch velocity off a kicker
export const PERFECT_POP_BONUS = 320; // extra launch for a well-timed pop
export const POP_WINDOW = 0.2; // seconds around the lip that count as "perfect"
export const FLAT_OLLIE_VELOCITY = 600; // pop off flat water

// Kicker geometry — the rider climbs this triangular ramp to the lip
export const KICKER_RISE = 122; // px the lip sits above the water
export const KICKER_WIDTH = 240; // horizontal length of the ramp

// Rider rendering
export const RIDER_SCALE = 0.82; // base display scale of the rider sprite

// Trick rotation -------------------------------------------------------------
export const FLIP_IMPULSE = 430; // deg/s added per vertical flick (roll)
export const SPIN_IMPULSE = 360; // deg/s added per horizontal flick (yaw)
export const ROT_MAX = 1100; // clamp angular velocity (deg/s)
export const LAND_FLIP_TOLERANCE = 42; // deg from an upright multiple of 360
export const LAND_SPIN_TOLERANCE = 48; // deg from a clean multiple of 180

// Scoring --------------------------------------------------------------------
export const PTS_PER_FLIP = 500; // per completed roll (360 of flip)
export const PTS_PER_SPIN = 300; // per 180 of spin
export const PTS_GRAB_PER_SEC = 900; // grab points accrue while held
export const PTS_GRIND_PER_SEC = 700; // grind points accrue while sliding
export const PTS_PERFECT_POP = 250;
export const PTS_PERFECT_LAND = 400;
export const COMBO_DECAY = 1.6; // seconds the combo window stays open on the ground

// Gesture thresholds ---------------------------------------------------------
export const FLICK_MIN_DIST = 26; // px of drag to register a flick
export const TAP_MAX_DIST = 18; // below this + quick = a tap (pop)
export const TAP_MAX_TIME = 220; // ms
export const HOLD_MIN_TIME = 130; // ms held (in air) before it counts as a grab

// Module spawning ------------------------------------------------------------
export const SPAWN_GAP_MIN = 520; // px between features (world units)
export const SPAWN_GAP_MAX = 980;

// Palette --------------------------------------------------------------------
export const COLORS = {
  skyTop: 0x123c52,
  skyBottom: 0x2a7a9b,
  sun: 0xffe7a8,
  hills: 0x0e4456,
  hillsFar: 0x16566b,
  waterTop: 0x1f8fb0,
  waterDeep: 0x0c4a60,
  foam: 0xd9f4ff,
  rider: 0xff5e3a,
  riderDark: 0xc23a1e,
  board: 0xffd23f,
  rail: 0xb8c4cc,
  railLeg: 0x6d7c86,
  kicker: 0x16566b,
  kickerTop: 0x33d6c8,
  cable: 0x0a2733,
  text: 0xffffff,
  accent: 0x33d6c8,
  bad: 0xff4d6d,
};
