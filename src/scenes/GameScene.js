import Phaser from "phaser";
import * as C from "../config.js";
import {
  landingError,
  isCleanLanding,
  wipesOutOnWaterLanding,
  countRotations,
  scoreLanding,
  buildTrickName,
  surfaceSpinPoints,
  grabName,
  airInputFromDrag,
  airStep,
  edgeLoadAfter,
  popVelocityFromLoad,
  edgeName,
  handlePassState,
  signatureBonus,
} from "../physics.js";
import { pickModule, moduleFootprint } from "../modules.js";
import { difficultyForElapsed } from "../difficulty.js";
import { audio } from "../audio.js";

const DEG = Phaser.Math.DEG_TO_RAD;

// State machine for the rider.
const RIDE = "ride";
const AIR = "air";
const GRIND = "grind";
const WIPEOUT = "wipeout";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  // Run configuration from the caller (defaults = the classic free run):
  //   mode: "free" | "daily"   seed: deterministic layout seed (daily challenge)
  init(data) {
    this.runMode = (data && data.mode) || "free";
    this.runSeed = (data && data.seed) || null;
  }

  create() {
    // Pull the camera back so the rider sits further away and the tow rope reads
    // longer. Backgrounds are drawn oversized (by these margins) to fill the
    // reveal. Gameplay math is in world units and is unaffected by the zoom.
    this.cameras.main.setZoom(C.CAMERA_ZOOM);
    this.mx = Math.ceil((C.VIRTUAL_WIDTH / 2) * (1 / C.CAMERA_ZOOM - 1)) + 24;
    this.my = Math.ceil((C.VIRTUAL_HEIGHT / 2) * (1 / C.CAMERA_ZOOM - 1)) + 24;

    // Per-run time-of-day mood, applied as a subtle color grade (WebGL-only; the
    // HUD is a separate scene, so it stays crisp and ungraded). Gives each run a
    // slightly different light — bright midday, warm golden hour, cool dusk.
    const MOODS = [
      { name: "midday", hue: 0, sat: 0.16, bright: 1.03, contrast: 0.05 },
      { name: "golden", hue: 10, sat: 0.3, bright: 1.06, contrast: 0.08 },
      { name: "dusk", hue: -12, sat: 0.22, bright: 0.92, contrast: 0.06 },
    ];
    this.mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    if (this.renderer.type === Phaser.WEBGL) {
      this.grade = this.cameras.main.postFX.addColorMatrix();
      this.grade
        .hue(this.mood.hue)
        .saturate(this.mood.sat)
        .contrast(this.mood.contrast)
        .brightness(this.mood.bright);
    }

    // Slow-mo: gameplay time is scaled by this while a big trick lands (the run
    // clock stays real-time so it never penalises the player).
    this.gameTimeScale = 1;
    this._slowmoActive = false;

    this.buildBackground();
    this.buildWater();
    this.buildRider();

    // World / run state ------------------------------------------------------
    this.scrollX = 0; // rider's world position (px)
    this.speed = C.BASE_SPEED;
    this.state = RIDE;

    // Stance: 0 = regular (as drawn), 1 = switch. A landed odd number of 180s
    // flips it, so the rider keeps the opposite foot forward until the next one.
    this.stance = 0;

    // Load & pop charge ------------------------------------------------------
    this.charging = false;
    this.chargeTime = 0;
    this.lastPopRelease = -10;

    // Edge / carve load: held on the water (button + steer), throws you off the
    // kicker. Persists briefly after release (decays) to carry into the lip.
    this.edgeLoad = 0;
    this.edgeDir = 0; // −1 heelside, +1 toeside
    this.edging = false;
    this.edgedTakeoff = false; // did this airtime launch off a loaded edge? (for B5)
    this.airFlat = false; // launched by a flat-water hop (non-scoring)

    // Air / trick state ------------------------------------------------------
    this.y = C.WATER_Y;
    this.vy = 0;
    this.flipDeg = 0;
    this.flipVel = 0;
    this.spinDeg = 0;
    this.spinVel = 0;
    this.surfaceSpinDeg = 0; // monotonic grounded-spin total awaiting points
    this.surfaceSpin180s = 0; // completed 180s already banked this surface session
    this.grabbing = false;
    this.grabTime = 0;
    this.didGrab = false; // a grab was held this airtime
    this.grabDir = { x: 0, y: 0 }; // last held grab direction
    this.raley = false; // superman pose is LIVE (button held) right now
    this.didRaley = false; // a Raley was thrown this airtime (naming/scoring)
    this.airSwitch = false; // took off switch this airtime
    this.pressDir = 0; // rail press: +1 nose press (↑), −1 tail press (↓)
    this.pressTime = 0; // how long the current press has been held (s)
    this.rampT = 0; // 0 on flat water, →1 climbing a kicker to the lip
    this.rampAngle = 0;
    this.prevState = RIDE;

    // A seeded RNG makes a daily-challenge layout identical for everyone; a free
    // run uses the global RNG. Drives module pick + spawn gaps.
    this.rng = this.runSeed
      ? new Phaser.Math.RandomDataGenerator([String(this.runSeed)])
      : null;

    // Run summary fed to the progression system on Game Over.
    this.summary = { score: 0, bestCombo: 1, tricksLanded: 0, wipeouts: 0 };

    // Combo / scoring --------------------------------------------------------
    this.score = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.pending = 0; // points earned in the current airtime, awarded on clean land
    this.trickParts = []; // names accumulated this airtime

    // Difficulty (drives speed target, spawn gaps, module mix) ---------------
    this.difficulty = difficultyForElapsed(0);

    // Features ---------------------------------------------------------------
    this.features = this.add.group();
    this.nextSpawnX = 700;
    for (let i = 0; i < 6; i++) this.spawnFeature();

    this.activeRail = null; // rail the rider is currently grinding
    this.popHintGiven = false;

    // Time-attack run timer
    this.timeLeft = C.RUN_DURATION;

    this._lastMult = 1; // for combo-up sound edge detection

    this.setupInput();
    this.emitScore();
    this.emitSpeed();
    this.emitTime();

    audio.startHum(); // cable tow drone for the run
    audio.playMusic("music_run"); // real track if loaded, else silent (hum stays)
    this.events.once("shutdown", () => {
      audio.stopHum();
      audio.stopMusic();
    });

    this.game.events.emit("message", "RIDE!", 900);
  }

  // ==========================================================================
  // Build helpers
  // ==========================================================================
  buildBackground() {
    const W = C.VIRTUAL_WIDTH;
    const H = C.VIRTUAL_HEIGHT;
    const MX = this.mx;
    const MY = this.my;
    this.add
      .image(-MX, -MY, "sky")
      .setOrigin(0, 0)
      .setDisplaySize(W + 2 * MX, H + 2 * MY)
      .setScrollFactor(0);

    // sun glow
    this.add.circle(W * 0.78, 150, 70, C.COLORS.sun, 0.85).setScrollFactor(0);
    this.add.circle(W * 0.78, 150, 110, C.COLORS.sun, 0.18).setScrollFactor(0);

    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const cl = this.add
        .image(Phaser.Math.Between(-MX, W + MX), Phaser.Math.Between(40, 220), "cloud")
        .setScrollFactor(0)
        .setAlpha(0.8)
        .setScale(Phaser.Math.FloatBetween(0.7, 1.4));
      cl.drift = Phaser.Math.FloatBetween(6, 16);
      this.clouds.push(cl);
    }

    // farthest ridge line — tall, slow, desaturated for aerial depth
    this.mountains = this.add
      .tileSprite(-MX, 120, W + 2 * MX, 300, "mountains")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.75);
    this.hillsFar = this.add
      .tileSprite(-MX, 150, W + 2 * MX, 300, "hillsFar")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.hills = this.add
      .tileSprite(-MX, 180, W + 2 * MX, 300, "hills")
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // single overhead cable line (the rider's tow rope hangs from a trolley
    // that rides along it). No pylons / hanging clutter.
    this.cableY = 118;
    this.cableGfx = this.add.graphics().setScrollFactor(0).setDepth(2);
  }

  buildWater() {
    const W = C.VIRTUAL_WIDTH;
    const H = C.VIRTUAL_HEIGHT;
    const MX = this.mx;
    const MY = this.my;
    // deep water block (oversized to fill the zoomed-out reveal)
    this.add
      .rectangle(-MX, C.WATER_Y, W + 2 * MX, H + 2 * MY - C.WATER_Y, C.COLORS.waterDeep)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.add
      .rectangle(-MX, C.WATER_Y, W + 2 * MX, 60, C.COLORS.waterTop)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.85);

    // hill reflection under the surface: a flipped, dimmed copy of the near
    // hills, gently wobbling — cheap fake reflection (no render-texture cost).
    this.reflection = this.add
      .tileSprite(-MX, C.WATER_Y, W + 2 * MX, 150, "hills")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setFlipY(true)
      .setAlpha(0.16)
      .setDepth(1);

    // a soft mist band hugging the horizon line
    this.add
      .rectangle(-MX, C.WATER_Y - 26, W + 2 * MX, 34, 0xdff1f6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.1)
      .setDepth(1);

    // animated foam line
    this.foam = this.add.graphics().setScrollFactor(0);
  }

  buildRider() {
    const bodyOrigin = this.registry.get("bodyOrigin") || { x: 0.5, y: 0.94 };
    this.bodyShoulder = this.registry.get("bodyShoulder") || { x: 0, y: -72 };
    this.boardGeom = this.registry.get("boardGeom") || {
      topLocalY: -2,
      backFootX: -30,
      frontFootX: 30,
      bootTopY: -19,
    };

    // The rider is a CONTAINER pivoting at the board's top surface, so the whole
    // rig rotates together for flips and the feet stay locked to the board.
    //   - board (boots baked on) at the bottom
    //   - legs + arms: Graphics redrawn every frame (flex/extend, follow handle)
    //   - body: torso+head sprite hung off the hips, rotated for the lean
    this.legsGfx = this.add.graphics();
    this.armsGfx = this.add.graphics();
    this.board = this.add.image(0, -this.boardGeom.topLocalY, "board");
    // A Sprite (not Image) so it can play per-state rider animations when a real
    // atlas is present; with the procedural texture it just shows a static frame.
    this.body = this.add.sprite(0, 0, "body").setOrigin(bodyOrigin.x, bodyOrigin.y);

    this.riderC = this.add
      .container(C.RIDER_SCREEN_X, C.WATER_Y, [this.board, this.legsGfx, this.body, this.armsGfx])
      .setDepth(11);

    this.crouch = 0.35; // 0 = legs extended, 1 = deeply bent
    this.lean = 0; // upper-body lean against the cable pull (radians)
    this.tuckLift = 0; // how far the board is pulled up toward the body (grab)
    this.raleyAmt = 0; // 0..1 eased blend into the Raley superman pose
    this.pressAmt = 0; // −1..1 eased rail-press pitch (+nose / −tail)

    // tow rope from a trolley on the overhead cable to the rider's handle
    this.rope = this.add.graphics().setDepth(9).setScrollFactor(0);
    this.trolley = this.add.rectangle(C.RIDER_SCREEN_X + 40, this.cableY, 26, 10, 0x0a2733)
      .setScrollFactor(0)
      .setDepth(3);

    // spray emitter that follows the board on the water
    this.spray = this.add.particles(0, 0, "spray", {
      speed: { min: 40, max: 160 },
      angle: { min: 200, max: 250 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 420,
      frequency: 60,
      tint: C.COLORS.foam,
      emitting: false,
    });
    this.spray.setDepth(8);
  }

  // ==========================================================================
  // Feature spawning (kickers & rails) — recycled as they scroll off-screen
  // ==========================================================================
  spawnFeature() {
    const frac = this.rng ? () => this.rng.frac() : () => Phaser.Math.RND.frac();
    const def = pickModule(frac, this.difficulty);
    const baseX = this.nextSpawnX;

    // Each segment is its own interactive (or decorative) piece at its offset,
    // so composites reuse the per-piece kicker / rail physics directly.
    for (const seg of def.segments) {
      this.spawnSegment(def, seg, baseX + seg.offset);
    }

    const footprint = moduleFootprint(def);
    const d = this.difficulty;
    const gap = this.rng
      ? this.rng.between(d.gapMin, d.gapMax)
      : Phaser.Math.Between(d.gapMin, d.gapMax);
    this.nextSpawnX = baseX + footprint + gap;
    return def;
  }

  spawnSegment(def, seg, worldX) {
    const obj = this.add
      .image(0, 0, seg.texture)
      .setOrigin(seg.origin.x, seg.origin.y)
      .setDepth(def.depth);
    obj.worldX = worldX;
    obj.width0 = seg.width;
    obj.moduleType = def.type;

    if (seg.kind === "ride-up") {
      obj.featureType = "kicker";
      obj.rise = seg.rise; // per-feature climb height (big kicker / A-frame)
      obj.y = C.WATER_Y; // origin (0,1) rests the ramp base on the water
    } else if (seg.kind === "grind") {
      obj.featureType = "rail";
      obj.railTopY = C.WATER_Y - seg.surfaceDrop; // grind surface height
      obj.y = obj.railTopY - seg.imageYOffset;
    } else {
      obj.featureType = "decor"; // non-interactive (A-frame back face)
      obj.y = C.WATER_Y - seg.height;
    }

    this.features.add(obj);
    return obj;
  }

  recycleFeatures() {
    this.features.getChildren().forEach((f) => {
      const screenX = C.RIDER_SCREEN_X + (f.worldX - this.scrollX);
      if (screenX + f.width0 < -80) {
        f.destroy();
      }
    });
    // keep ~6 ahead
    while (this.features.getLength() < 6) this.spawnFeature();
  }

  // ==========================================================================
  // Input
  // ==========================================================================
  setupInput() {
    // Two touch pointers so a finger can spin/flip while a second finger grabs.
    this.input.addPointer(1);

    // PRIMARY gesture: ground charge + ground surface-spin flicks + in-air
    // rotation (its held drag vector drives spin/flip, see readAirRotation).
    this.gesture = { active: false, sx: 0, sy: 0, t0: 0, flicked: false, pointer: null, id: -1 };
    // GRAB pointer: a second finger held in the air = a grab (while the first
    // finger is free to keep spinning). Direction comes from its drag offset.
    this.grabG = { active: false, sx: 0, sy: 0, t0: 0, pointer: null, id: -1 };

    this.input.on("pointerdown", (p) => {
      audio.resume(); // unlock audio on the first gesture
      if (!this.gesture.active) {
        this.gesture.active = true;
        this.gesture.sx = p.x;
        this.gesture.sy = p.y;
        this.gesture.t0 = this.time.now;
        this.gesture.flicked = false;
        this.gesture.pointer = p;
        this.gesture.id = p.id;
        // on the ground, a held press loads the pop (released on pointerup)
        this.beginCharge();
      } else if (p.id !== this.gesture.id && !this.grabG.active) {
        // a second finger becomes the grab pointer
        this.grabG.active = true;
        this.grabG.sx = p.x;
        this.grabG.sy = p.y;
        this.grabG.t0 = this.time.now;
        this.grabG.pointer = p;
        this.grabG.id = p.id;
      }
    });

    this.input.on("pointermove", (p) => {
      // In the air both rotation (primary) and grab (secondary) read the live
      // pointer positions each frame, so no move-time bookkeeping is needed.
      if (this.state === AIR) return;
      if (!this.gesture.active || p.id !== this.gesture.id) return;
      const dx = p.x - this.gesture.sx;
      const dy = p.y - this.gesture.sy;
      if (Math.hypot(dx, dy) >= C.FLICK_MIN_DIST) {
        this.doFlick(dx, dy);
        // reset origin so a continuous drag chains more flicks ("stirring")
        this.gesture.sx = p.x;
        this.gesture.sy = p.y;
        this.gesture.flicked = true;
        this.charging = false; // a swipe is a spin, not a load
      }
    });

    this.input.on("pointerup", (p) => {
      if (this.grabG.active && p.id === this.grabG.id) {
        this.grabG.active = false;
        this.grabG.pointer = null;
        return;
      }
      if (!this.gesture.active || p.id !== this.gesture.id) return;
      // release a held load into a pop (a quick tap = tiny load = small hop)
      if (this.charging && !this.gesture.flicked) this.releasePop();
      this.gesture.active = false;
      this.gesture.pointer = null;
      this.charging = false;
      this.grabbing = false;
    });

    // keyboard for desktop testing
    const k = this.input.keyboard;
    this.keys = k.addKeys({
      up: "UP",
      down: "DOWN",
      left: "LEFT",
      right: "RIGHT",
      space: "SPACE",
      // grabs: E=up (Method), X=down (Indy), S=left (Tail), D=right (Nose);
      // combinations give Mute / Stalefish. Any of them held = grabbing.
      grabUp: "E",
      grabDown: "X",
      grabLeft: "S",
      grabRight: "D",
    });
    k.on("keydown-UP", () => this.doFlick(0, -100));
    k.on("keydown-DOWN", () => this.doFlick(0, 100));
    k.on("keydown-LEFT", () => this.doFlick(-100, 0));
    k.on("keydown-RIGHT", () => this.doFlick(100, 0));
    k.on("keydown-SPACE", () => {
      audio.resume();
      this.beginCharge();
    });
    k.on("keyup-SPACE", () => {
      if (this.charging) this.releasePop();
    });
    k.on("keydown-M", () => {
      const muted = audio.toggleMute();
      if (!muted) audio.startHum();
      this.game.events.emit("message", muted ? "SON OFF" : "SON ON", 500);
    });
  }

  // Begin loading a pop. Only meaningful on a surface (water / kicker / rail);
  // the charge builds each frame in updateState while held.
  beginCharge() {
    if (this.state === RIDE || this.state === GRIND) {
      this.charging = true;
      this.chargeTime = 0;
    }
  }

  // 0..1 fraction of a full load.
  chargeRatio() {
    return Phaser.Math.Clamp(this.chargeTime / C.CHARGE_MAX_TIME, 0, 1);
  }

  // Release the button. Off a rail it pops (scaled by the hold). On a kicker face
  // the pop is powered by the EDGE LOAD (built on the approach) and can be
  // "perfect". On flat water the release is a charge-scaled ollie — enough to
  // pop up onto a module (a bare ollie stays non-scoring, see the `flat` flag).
  releasePop() {
    const r = this.chargeRatio();
    this.lastPopRelease = this.time.now / 1000;

    if (this.state === GRIND) {
      this.popOffRail(Phaser.Math.Linear(C.GRIND_POP_MIN, C.GRIND_POP_MAX, r));
    } else if (this.state === RIDE) {
      if (this.rampT > 0.02) {
        // on a kicker face — releasing near the lip pops big + perfect
        const perfect = this.rampT >= 0.72;
        const v = popVelocityFromLoad(
          this.edgeLoad,
          C.KICKER_POP_MIN,
          C.KICKER_POP_MAX,
          perfect,
          C.PERFECT_POP_BONUS
        );
        this.launch(v, perfect);
      } else {
        // flat-water ollie: load the line and pop. Scales with the hold so a
        // tap is a small hop and a full load clears up onto a box/module. Kept
        // `flat` so an empty ollie (no trick) doesn't farm combo/landing points.
        this.launch(
          Phaser.Math.Linear(C.FLAT_OLLIE_MIN, C.FLAT_OLLIE_VELOCITY, r),
          false,
          { flat: true }
        );
      }
    }
    this.charging = false;
    this.chargeTime = 0;
    this.emitCharge();
  }

  doFlick(dx, dy) {
    const horizontal = Math.abs(dx) > Math.abs(dy);

    // In the air, rotation is driven by HELD arrow keys (see updateState AIR),
    // not by flick impulses — so a flick does nothing airborne.
    if (this.state === AIR) return;

    // While loading an edge (button held on a surface), a horizontal steer picks
    // the edge SIDE rather than adding a surface spin.
    if (this.charging && (this.state === RIDE || this.state === GRIND)) {
      if (horizontal) this.edgeDir = Math.sign(dx);
      return;
    }

    // On the surface (water / kicker / slide): only SPINS are possible. A
    // vertical flip gesture is ignored — flips are strictly an in-air move.
    if (this.state === RIDE || this.state === GRIND) {
      if (!horizontal) return;
      this.spinVel = Phaser.Math.Clamp(
        this.spinVel + Math.sign(dx) * C.SURFACE_SPIN_IMPULSE,
        -C.ROT_MAX,
        C.ROT_MAX
      );
    }
  }

  // Any grab key currently held?
  grabKeyDown() {
    const k = this.keys;
    return k.grabUp.isDown || k.grabDown.isDown || k.grabLeft.isDown || k.grabRight.isDown;
  }

  // Re-anchor the touch origins to where the fingers are right now. Called on
  // takeoff so an in-air drag is measured from the launch moment, not from a
  // stale ground touchdown.
  reoriginPointers() {
    if (this.gesture.active && this.gesture.pointer) {
      this.gesture.sx = this.gesture.pointer.x;
      this.gesture.sy = this.gesture.pointer.y;
    }
    if (this.grabG.active && this.grabG.pointer) {
      this.grabG.sx = this.grabG.pointer.x;
      this.grabG.sy = this.grabG.pointer.y;
    }
  }

  // In-air rotation from the PRIMARY finger's held drag (touch). A drag past the
  // threshold spins/flips at ±ROT_RATE and snaps to 0 when centered — the same
  // "held, stops on release" feel as the arrow keys. Neutral if no finger down.
  readAirRotation() {
    const g = this.gesture;
    if (!g.active || !g.pointer) return { spinVel: 0, flipVel: 0, rotating: false };
    return airInputFromDrag(
      g.pointer.x - g.sx,
      g.pointer.y - g.sy,
      C.FLICK_MIN_DIST,
      C.ROT_RATE
    );
  }

  // The grab direction held in the air: E/S/D/X grab keys take priority, then
  // the second (grab) finger's drag, then a still primary finger's drag.
  readGrabDir() {
    const k = this.keys;
    let x = (k.grabRight.isDown ? 1 : 0) - (k.grabLeft.isDown ? 1 : 0);
    let y = (k.grabDown.isDown ? 1 : 0) - (k.grabUp.isDown ? 1 : 0);
    if (x === 0 && y === 0) {
      if (this.grabG.active && this.grabG.pointer) {
        x = this.grabG.pointer.x - this.grabG.sx;
        y = this.grabG.pointer.y - this.grabG.sy;
      } else if (this.gesture.active && this.gesture.pointer) {
        x = this.gesture.pointer.x - this.gesture.sx;
        y = this.gesture.pointer.y - this.gesture.sy;
      }
    }
    return { x, y };
  }

  // Map the held grab to a pose: where along the board the back hand reaches
  // (gx, board-local px; +nose / −tail) and how far the board tucks up (lift).
  // This gives each grab a distinct silhouette.
  grabPose() {
    const d = this.grabDir;
    switch (grabName(d.x, d.y)) {
      case "Nose":
        return { gx: 60, lift: 30 };
      case "Tail":
        return { gx: -60, lift: 30 };
      case "Method":
        return { gx: -30, lift: 50 };
      case "Mute":
        return { gx: 52, lift: 42 };
      case "Stalefish":
        return { gx: -52, lift: 42 };
      default:
        return { gx: 8, lift: 34 }; // Indy
    }
  }

  // ==========================================================================
  // State transitions
  // ==========================================================================
  launch(velocity, perfect, { flat = false } = {}) {
    this.state = AIR;
    this.vy = -velocity;
    this.crouch = 0; // legs snap straight to push off
    this.activeRail = null;
    // Remember whether we left off a loaded edge (drives the Tantrum in B5), then
    // spend the edge load. A flat hop is a non-scoring nothing.
    this.edgedTakeoff = !flat && this.edgeLoad > 0.45;
    this.airFlat = flat;
    this.airSwitch = this.stance === 1; // riding switch at takeoff
    this.raley = false;
    this.edgeLoad = 0;
    this.edging = false;
    this.resetSurfaceSpin(); // spin in progress carries over via spinDeg/spinVel
    audio.play(perfect ? "perfectPop" : "pop");
    if (perfect) {
      this.pending += C.PTS_PERFECT_POP;
      this.trickParts.push("Perfect Pop");
      this.popBurst();
    }
  }

  popOffRail(velocity) {
    this.activeRail = null;
    this.pressDir = 0;
    this.pressTime = 0;
    this.state = AIR;
    this.vy = -velocity;
    this.edgedTakeoff = false;
    this.airFlat = false;
    this.airSwitch = this.stance === 1;
    this.raley = false;
    this.resetSurfaceSpin();
    audio.play("pop");
  }

  land(clean, label) {
    if (clean) {
      // Signature flags for this airtime. "Lands blind" = an odd number of half
      // rotations puts the opposite foot forward (you touch down riding switch).
      const { flips } = countRotations(this.flipDeg, this.spinDeg);
      const tantrum = this.edgedTakeoff && this.flipDeg < 0 && flips >= 1;
      const landsBlind = Math.abs(Math.round(this.spinDeg / 180)) % 2 === 1;
      // Bank the signature bonuses via `pending` so scoreLanding's tested
      // signature is untouched.
      this.pending += signatureBonus({
        raley: this.didRaley,
        tantrum,
        switchStance: this.airSwitch,
        landsBlind,
      });

      // award the rotation itself (flips + spins), then the landing bonus
      const { spins } = countRotations(this.flipDeg, this.spinDeg);
      const gained = scoreLanding({
        flips,
        spins,
        pending: this.pending,
        multiplier: this.multiplier,
      });
      this.score += gained;
      if (this.didGrab) {
        this.trickParts.push(`${grabName(this.grabDir.x, this.grabDir.y)} Grab`);
      }
      const name = buildTrickName({
        flipDeg: this.flipDeg,
        spinDeg: this.spinDeg,
        extras: this.trickParts,
        raley: this.didRaley,
        edged: this.edgedTakeoff,
        switchStance: this.airSwitch,
        landsBlind,
      });
      this.multiplier += 1;
      this.comboTimer = C.COMBO_DECAY;
      audio.play("land");
      // Celebrate a big score/combo with a brief slow-mo beat.
      if (gained >= 2500 || this.multiplier >= 5) this.triggerSlowMo();
      if (name) {
        this.summary.tricksLanded += 1;
        this.game.events.emit("trick", name, gained, this.multiplier);
      }
      if (label) this.game.events.emit("message", label, 600);
      this.emitScore();
      this.emitCombo();
    }
    // An odd number of half-rotations lands the rider switch: keep the opposite
    // foot forward until another odd half-rotation flips the stance back.
    if (Math.abs(Math.round(this.spinDeg / 180)) % 2 === 1) this.stance ^= 1;
    this.resetAir();
    this.state = RIDE;
    this.y = C.WATER_Y;
    this.crouch = 1; // legs bend deep to absorb the landing
  }

  wipeout() {
    this.state = WIPEOUT;
    this.summary.wipeouts += 1;
    this.wipeTimer = 0.85;
    this.crouch = 1; // buckle on impact
    this.speed = C.MIN_SPEED;
    this.multiplier = 1;
    this.pending = 0;
    this.trickParts = [];
    this.grabbing = false;
    this.charging = false;
    this.edgeLoad = 0; // a bail dumps any banked edge load
    this.edging = false;
    this.edgeDir = 0;
    this.stance = 0; // a bail resets you to a regular stance
    this.gameTimeScale = 1; // never carry a slow-mo beat into a bail
    this._slowmoActive = false;
    this.tweens.killTweensOf(this);
    this.splash();
    this.cameras.main.shake(260, 0.014); // impact jolt (HUD scene is unaffected)
    audio.play("wipeout");
    this.game.events.emit("message", "WIPEOUT!", 700, true);
    this.emitCombo();
  }

  resetAir() {
    this.vy = 0;
    this.flipDeg = 0;
    this.flipVel = 0;
    this.spinDeg = 0;
    this.spinVel = 0;
    this.grabbing = false;
    this.grabTime = 0;
    this.didGrab = false; // a grab was held this airtime
    this.grabDir = { x: 0, y: 0 }; // last held grab direction
    this.raley = false;
    this.didRaley = false;
    this.airFlat = false;
    this.pending = 0;
    this.trickParts = [];
    this.resetSurfaceSpin();
  }

  // End the current grounded-spin session. spinDeg / spinVel are intentionally
  // NOT cleared here so a spin in progress carries over into the air on a pop.
  resetSurfaceSpin() {
    this.surfaceSpinDeg = 0;
    this.surfaceSpin180s = 0;
  }

  // Build the loaded pop while the button is held on a surface, feeding the HUD
  // charge bar. Capped at a full load so it can't grow forever.
  tickCharge(dt) {
    if (!this.charging) return;
    this.chargeTime = Math.min(C.CHARGE_MAX_TIME, this.chargeTime + dt);
    this.emitCharge();
  }

  // Build/decay the edge load. Holding the button on the water = edging; steering
  // ←/→ (held keys or a drag while charging, gated in doFlick) picks the side.
  // Defaults to heelside. The load persists and bleeds off after release.
  tickEdge(dt) {
    const wasEdging = this.edging;
    this.edging = this.charging;
    if (this.edging) {
      const ex = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
      if (ex !== 0) this.edgeDir = ex;
      else if (this.edgeDir === 0) this.edgeDir = -1; // default heelside
      if (!wasEdging) audio.play("carve"); // spray hiss as the edge digs in
    }
    this.edgeLoad = edgeLoadAfter(
      this.edgeLoad,
      dt,
      this.edging,
      C.EDGE_LOAD_TIME,
      C.EDGE_DECAY_TIME
    );
    if (this.edging) this.emitCharge();
  }

  // Integrate a flat (yaw-only) spin while on the water or a module, banking
  // points + a trick-feed entry per completed 180. This path never wipes out.
  tickSurfaceSpin(dt) {
    if (this.state !== RIDE && this.state !== GRIND) return;
    if (this.spinVel === 0) return;

    this.spinDeg += this.spinVel * dt;
    this.surfaceSpinDeg += Math.abs(this.spinVel) * dt;
    this.spinVel = Phaser.Math.Linear(this.spinVel, 0, C.SURFACE_SPIN_FRICTION * dt);
    const stopped = Math.abs(this.spinVel) < 2;
    if (stopped) this.spinVel = 0;

    const done = Math.floor(this.surfaceSpinDeg / 180);
    if (done > this.surfaceSpin180s) {
      const gained = surfaceSpinPoints((done - this.surfaceSpin180s) * 180);
      this.surfaceSpin180s = done;
      this.score += gained;
      this.multiplier += 1;
      this.comboTimer = C.COMBO_DECAY;
      this.emitScore();
      this.emitCombo();
      audio.play("surfaceSpin");
      this.game.events.emit("trick", `Surface ${done * 180}`, gained, this.multiplier);
    }

    // When the surface spin settles, fold a net odd 180 into the switch stance
    // and normalize the facing to forward — so the rider is never left mirrored
    // (riding backward) on the water; only the stance (front/back view) persists.
    if (stopped) {
      if (Math.abs(Math.round(this.spinDeg / 180)) % 2 === 1) this.stance ^= 1;
      this.spinDeg = 0;
      this.resetSurfaceSpin();
    }
  }

  // ==========================================================================
  // Update loop
  // ==========================================================================
  update(time, delta) {
    const dt = delta / 1000;
    if (dt > 0.05) return; // skip huge frame hitches

    // run timer (time-attack) — counts down regardless of trick state; a
    // wipeout never ends the run, only the clock running out does.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.emitTime();
      this.endRun();
      return;
    }
    this.emitTime();

    // difficulty ramps with elapsed run time
    this.difficulty = difficultyForElapsed(C.RUN_DURATION - this.timeLeft);

    // Gameplay time can be slowed for a slow-mo beat on a big landing; the run
    // clock above already advanced in real time so slow-mo is never a penalty.
    const gdt = dt * this.gameTimeScale;

    // scroll the world
    this.scrollX += this.speed * gdt;

    // climb toward (and recover after a bail relative to) the current speed target
    const speedTarget = this.difficulty.speedTarget;
    if (this.state !== WIPEOUT && this.speed < speedTarget) {
      this.speed = Math.min(speedTarget, this.speed + C.SPEED_RECOVER * gdt);
      this.emitSpeed();
    }

    this.updateState(gdt, time);
    if (this.state !== this.prevState) {
      // On takeoff, re-anchor the touch origins so an in-air drag rotates from
      // the launch moment rather than a stale ground touchdown.
      if (this.state === AIR) this.reoriginPointers();
      this.game.events.emit("state", this.state);
      this.prevState = this.state;
    }
    if (this.multiplier > this.summary.bestCombo) this.summary.bestCombo = this.multiplier;

    this.positionFeatures();
    this.recycleFeatures();
    this.updateBackground(gdt);
    this.updateRiderVisual();
    this.emitSpeed();
  }

  // A short slow-mo beat to celebrate a big landing. The tween runs on the real
  // clock (gameplay dt is what's scaled), so it always eases back to full speed.
  triggerSlowMo() {
    if (this._slowmoActive) return;
    this._slowmoActive = true;
    this.tweens.add({
      targets: this,
      gameTimeScale: 0.4,
      duration: 110,
      yoyo: true,
      hold: 170,
      ease: "Sine.inOut",
      onComplete: () => {
        this.gameTimeScale = 1;
        this._slowmoActive = false;
      },
    });
  }

  updateState(dt, time) {
    switch (this.state) {
      case RIDE:
        this.grabbing = false;
        this.tickCharge(dt); // build the loaded pop while held
        this.tickEdge(dt); // build/decay the edge load; steer picks the side
        this.rideKickerOrWater();
        this.tickSurfaceSpin(dt); // flat spins on water + kicker ride-up
        this.spray.emitting = this.rampT === 0; // spray only on the flat water
        // combo decay on the ground
        if (this.multiplier > 1) {
          this.comboTimer -= dt;
          if (this.comboTimer <= 0) {
            this.multiplier = 1;
            this.emitCombo();
          }
        }
        break;

      case AIR: {
        this.spray.emitting = false;
        // Floaty, cable-supported arc (pendular) instead of pure free fall.
        ({ y: this.y, vy: this.vy } = airStep(this.y, this.vy, dt, {
          gravity: C.AIR_GRAVITY,
          maxFall: C.AIR_MAX_FALL,
        }));

        // Rotation is HELD, not flicked, and stops the instant it is released
        // (velocity snaps to 0). Keyboard drives it via arrows; on touch the
        // ROTATE pointer's held drag vector drives it the same way (see
        // readAirRotation) so flips/spins are fully playable with a finger.
        const kx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
        const ky = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
        if (kx !== 0 || ky !== 0) {
          this.spinVel = kx * C.ROT_RATE;
          this.flipVel = ky * C.ROT_RATE;
        } else {
          const air = this.readAirRotation();
          this.spinVel = air.spinVel;
          this.flipVel = air.flipVel;
        }
        this.flipDeg += this.flipVel * dt;
        this.spinDeg += this.spinVel * dt;

        // Raley: board kicked out behind, body extended — HELD via SPACE
        // (keyboard) or the grab finger yanked hard DOWN (touch). Releasing
        // lets the rider swing back under the bar progressively (raleyAmt
        // eases down in updateRiderVisual); touching the water before the
        // board is back under you is a wipeout (see evaluateWaterLanding).
        // When triggered on touch it takes over the grab finger so it reads
        // as a Raley, not an Indy.
        let raleyTouch = false;
        if (this.grabG.active && this.grabG.pointer) {
          if (this.grabG.pointer.y - this.grabG.sy > C.FLICK_MIN_DIST * 2.2) raleyTouch = true;
        }
        this.raley = this.keys.space.isDown || raleyTouch; // live pose (held)
        if (this.raley) this.didRaley = true; // sticky for naming/scoring

        // grab: E/S/D/X held, OR a second finger held (grab while the primary
        // finger spins), OR the primary finger held STILL (single-finger grab —
        // a drag would be rotation instead, so "still" is what distinguishes it).
        const g = this.gesture;
        const primaryStill =
          g.active &&
          g.pointer &&
          Math.hypot(g.pointer.x - g.sx, g.pointer.y - g.sy) < C.FLICK_MIN_DIST &&
          time - g.t0 > C.HOLD_MIN_TIME;
        const holding =
          this.grabKeyDown() || (this.grabG.active && !raleyTouch) || primaryStill;
        this.grabbing = holding;
        if (holding) {
          this.grabTime += dt;
          this.pending += C.PTS_GRAB_PER_SEC * dt;
          this.didGrab = true;
          // the held direction picks the grab (keyboard arrows, else pointer drag)
          const d = this.readGrabDir();
          if (d.x !== 0 || d.y !== 0) this.grabDir = d;
        }

        // feed the HUD rotation indicator (how close to an upright landing)
        {
          const { flipErr, spinErr } = landingError(this.flipDeg, this.spinDeg);
          const ok = isCleanLanding(
            flipErr,
            spinErr,
            C.LAND_FLIP_TOLERANCE,
            C.LAND_SPIN_TOLERANCE
          );
          this.game.events.emit("rotation", { flipErr, spinErr, ok });
        }

        this.checkAirLanding();
        break;
      }

      case GRIND: {
        this.spray.emitting = false;
        this.tickCharge(dt); // load a pop off the rail
        // accrue grind points + keep the rider level on the rail
        this.pending += C.PTS_GRIND_PER_SEC * dt;
        this.flipDeg = Phaser.Math.Linear(this.flipDeg, 0, 0.3); // no flips on a rail
        this.tickSurfaceSpin(dt); // but surface spins ARE allowed while grinding
        // Rail presses: hold ↑ for a NOSE press (weight over the nose, tail
        // up) or ↓ for a TAIL press (nose up). Eased into the rig pitch in
        // updateRiderVisual; worth bonus points on top of the grind rate.
        const dir = (this.keys.up.isDown ? 1 : 0) - (this.keys.down.isDown ? 1 : 0);
        if (dir !== this.pressDir) this.pressTime = 0; // switching resets the clock
        this.pressDir = dir;
        if (dir !== 0) {
          this.pressTime += dt;
          this.pending += C.PTS_PRESS_PER_SEC * dt;
          const part = dir > 0 ? "Nose Press" : "Tail Press";
          if (this.pressTime > C.PRESS_NAME_TIME && !this.trickParts.includes(part)) {
            this.trickParts.push(part);
          }
        }
        this.y = this.activeRail.railTopY;
        // reached the end of the rail?
        const railEndWorld = this.activeRail.worldX + this.activeRail.width0 - 30;
        if (this.scrollX > railEndWorld) {
          if (!this.trickParts.includes("Grind")) this.trickParts.push("Grind");
          this.popOffRail(C.FLAT_OLLIE_VELOCITY * 0.55);
        }
        break;
      }

      case WIPEOUT:
        this.spray.emitting = false;
        this.wipeTimer -= dt;
        this.flipDeg += 320 * dt; // tumble
        this.y = C.WATER_Y;
        if (this.wipeTimer <= 0) {
          this.resetAir();
          this.state = RIDE;
        }
        break;
    }
  }

  // While riding: if a kicker is under the rider, glide up its triangular face
  // (rampT goes 0→1 from base to lip). At the lip, launch into the air.
  rideKickerOrWater() {
    const k = this.kickerUnderRider();
    if (k) {
      const rise = k.rise || C.KICKER_RISE; // per-kicker lip height
      const t = Phaser.Math.Clamp((this.scrollX - k.worldX) / k.width0, 0, 1);
      this.rampT = t;
      this.y = C.WATER_Y - t * rise;
      this.rampAngle = -Math.atan2(rise, k.width0); // nose-up tilt
      if (t >= 0.9) {
        // reached the lip — pop! Releasing a held edge right at the lip fires a
        // big, "perfect" pop; rolling off launches with whatever edge load is
        // still banked from the approach (a flat, unedged pass gives the base).
        if (this.charging) this.releasePop();
        else this.launch(
          popVelocityFromLoad(this.edgeLoad, C.KICKER_POP_MIN, C.KICKER_POP_MAX, false, 0),
          false
        );
      }
    } else {
      this.rampT = 0;
      this.rampAngle = 0;
      this.y = C.WATER_Y;
    }
  }

  kickerUnderRider() {
    for (const f of this.features.getChildren()) {
      if (f.featureType !== "kicker") continue;
      if (this.scrollX >= f.worldX && this.scrollX <= f.worldX + f.width0) return f;
    }
    return null;
  }

  checkAirLanding() {
    // descending only
    if (this.vy <= 0) return;

    // first, can we land/grind on a rail?
    for (const f of this.features.getChildren()) {
      if (f.featureType !== "rail") continue;
      const overStart = this.scrollX > f.worldX + 10;
      const overEnd = this.scrollX < f.worldX + f.width0 - 10;
      if (overStart && overEnd && this.y >= f.railTopY) {
        this.activeRail = f;
        this.state = GRIND;
        this.y = f.railTopY;
        this.vy = 0;
        this.crouch = 0.85; // bend on contact with the module
        audio.play("grind");
        return;
      }
    }

    // otherwise, land on the water
    if (this.y >= C.WATER_Y) {
      this.evaluateWaterLanding();
    }
  }

  evaluateWaterLanding() {
    // A trivial flat-water hop (no trick attempted) settles back down silently —
    // no score, no combo, no wipeout. Prevents the tiny "step onto a slide" hop
    // from farming landing points.
    if (this.airFlat && this.flipDeg === 0 && this.spinDeg === 0 && !this.didGrab && !this.didRaley) {
      this.airFlat = false;
      this.resetAir();
      this.state = RIDE;
      this.y = C.WATER_Y;
      this.crouch = 1;
      return;
    }
    const { flipErr, spinErr } = landingError(this.flipDeg, this.spinDeg);
    // The sole wipeout path: still grabbing, still stretched out in a Raley
    // (the board has not swung back under the rider), or not upright enough.
    if (
      wipesOutOnWaterLanding(
        this.grabbing,
        flipErr,
        spinErr,
        C.LAND_FLIP_TOLERANCE,
        C.LAND_SPIN_TOLERANCE,
        this.raleyAmt > C.RALEY_LAND_MAX
      )
    ) {
      this.wipeout();
      return;
    }
    const perfect = flipErr < 14 && spinErr < 16;
    this.land(true, perfect ? "PERFECT!" : "NICE!");
  }

  // ==========================================================================
  // Visuals
  // ==========================================================================
  positionFeatures() {
    this.features.getChildren().forEach((f) => {
      const screenX = C.RIDER_SCREEN_X + (f.worldX - this.scrollX);
      f.x = screenX;
    });
  }

  updateBackground(dt) {
    this.mountains.tilePositionX += this.speed * dt * 0.06;
    this.hillsFar.tilePositionX += this.speed * dt * 0.15;
    this.hills.tilePositionX += this.speed * dt * 0.3;
    // reflection tracks the near hills but wobbles for a watery shimmer
    this.reflection.tilePositionX = this.hills.tilePositionX;
    this.reflection.x = -this.mx + Math.sin(this.time.now / 700) * 4;

    for (const cl of this.clouds) {
      cl.x -= cl.drift * dt;
      if (cl.x < -this.mx - 80) cl.x = C.VIRTUAL_WIDTH + this.mx + 80;
    }

    // overhead cable
    this.cableGfx.clear();
    this.cableGfx.lineStyle(4, C.COLORS.cable, 1);
    this.cableGfx.beginPath();
    this.cableGfx.moveTo(-this.mx, this.cableY - 2);
    this.cableGfx.lineTo(C.VIRTUAL_WIDTH + this.mx, this.cableY - 2);
    this.cableGfx.strokePath();

    // animated foam line on the water
    this.foam.clear();
    this.foam.lineStyle(4, C.COLORS.foam, 0.9);
    this.foam.beginPath();
    const t = this.time.now / 320;
    const x0 = -this.mx;
    for (let x = x0; x <= C.VIRTUAL_WIDTH + this.mx; x += 18) {
      const y = C.WATER_Y + Math.sin(x * 0.04 + t) * 4 + Math.sin(x * 0.11 + t * 1.7) * 2;
      if (x === x0) this.foam.moveTo(x, y);
      else this.foam.lineTo(x, y);
    }
    this.foam.strokePath();
  }

  legLen(crouch) {
    // hip height above the ankle: long when extended, short when crouched
    return Phaser.Math.Linear(62, 28, crouch);
  }

  // Procedural legs: feet locked to the board, knees bend forward as the rider
  // crouches. Drawn in the container's local space (origin = board top surface).
  drawLegs(hipX, hipY, ankleY, crouch) {
    const g = this.legsGfx;
    g.clear();
    const shorts = 0xf2622c;
    const shortsDk = 0xc94e1f;
    const skin = 0xe7b48c;
    const skinDk = 0xcf9a72;
    // Knees ALWAYS bend forward (toward the nose / the pull). The legs are drawn
    // once; switch/spin flips the whole container, so the knees stay forward
    // relative to the (possibly reversed) body.
    const kneeFwd = 6 + crouch * 30;

    const leg = (fx, thighC, shinC, w) => {
      const kx = (fx + hipX) / 2 + kneeFwd;
      const ky = (ankleY + hipY) / 2;
      g.lineStyle(w, thighC, 1);
      g.beginPath();
      g.moveTo(hipX, hipY);
      g.lineTo(kx, ky);
      g.strokePath();
      g.lineStyle(w - 4, shinC, 1);
      g.beginPath();
      g.moveTo(kx, ky);
      g.lineTo(fx, ankleY);
      g.strokePath();
      g.fillStyle(thighC, 1);
      g.fillCircle(kx, ky, w / 2 - 1); // knee
    };

    leg(this.boardGeom.backFootX, shortsDk, skinDk, 18); // back leg (behind)
    leg(this.boardGeom.frontFootX, shorts, skin, 20); // front leg (accent)
    g.fillStyle(shorts, 1);
    g.fillRoundedRect(hipX - 13, hipY - 8, 26, 16, 7); // hips/seat
  }

  // Procedural arms: reach from the shoulders to the handle. Because the hand
  // point leads toward the cable, the arms naturally follow the handle as the
  // rider spins (the whole rig mirrors) and flips (the whole rig rotates).
  drawArms(sx, sy, hx, hy, grabPt, behind = false, spinThrow = 0) {
    const g = this.armsGfx;
    g.clear();
    const skin = 0xe7b48c;
    const skinDk = 0xcf9a72;

    const armTo = (ox, tx, ty, color, w) => {
      const ex = (sx + tx) / 2 + 4;
      const ey = (sy + ty) / 2 + 10; // elbow dips
      g.lineStyle(w, color, 1);
      g.beginPath();
      g.moveTo(sx + ox, sy + 2);
      g.lineTo(ex + ox, ey);
      g.lineTo(tx, ty);
      g.strokePath();
      g.fillStyle(color, 1);
      g.fillCircle(ex + ox, ey, w / 2 - 1);
      g.fillCircle(tx, ty, w / 2 - 2); // hand
    };

    if (grabPt) {
      // grabbing: front hand stays on the handle, back hand reaches down to
      // grab the board edge between the feet
      armTo(-4, grabPt.x, grabPt.y, skinDk, 11);
      armTo(4, hx, hy, skin, 12);
    } else if (behind) {
      // handle pass (backside only): ONE hand keeps the bar, routed behind the
      // back (hx/hy already sit at the small of the back); the free hand tucks
      // toward the hip, reading as the mid-pass release. Checked BEFORE the
      // throw pose — on a held backside spin the pass is the story.
      armTo(-4, sx - 16, sy + 20, skinDk, 11);
      armTo(4, hx, hy, skin, 12);
    } else if (spinThrow > 0.15) {
      // throwing a 180: the front hand drives the handle while the back arm is
      // flung out and up behind, sending the rotation (the shoulders lead).
      const tx = sx - (16 + 30 * spinThrow);
      const ty = sy - (14 + 34 * spinThrow);
      armTo(-4, tx, ty, skinDk, 11); // thrown arm
      armTo(4, hx, hy, skin, 12); // handle hand
    } else {
      armTo(-4, hx, hy, skinDk, 11);
      armTo(4, hx, hy, skin, 12);
    }

    // handle bar (palonier) in the lead hand
    g.lineStyle(6, 0x1c1c1c, 1);
    g.beginPath();
    g.moveTo(hx, hy - 12);
    g.lineTo(hx, hy + 12);
    g.strokePath();
    g.fillStyle(C.COLORS.board, 1);
    g.fillRoundedRect(hx - 3, hy - 12, 6, 24, 3);
  }

  // Play the animation for the current rider state IF a real atlas provided one
  // (see BootScene.registerRiderAnims). A no-op with the procedural rider, so
  // the hand-drawn body simply stays a static frame.
  applyRiderSkin() {
    let key = "rider_ride";
    if (this.state === WIPEOUT) key = "rider_wipeout";
    else if (this.state === GRIND) key = "rider_grind";
    else if (this.state === AIR) key = this.grabbing ? "rider_grab" : "rider_air";
    if (this.anims.exists(key)) this.body.play(key, true); // ignoreIfPlaying
  }

  updateRiderVisual() {
    this.applyRiderSkin();
    const x = C.RIDER_SCREEN_X;
    const S = C.RIDER_SCALE;
    const speedRatio = Phaser.Math.Clamp((this.speed - C.MIN_SPEED) / (C.MAX_SPEED - C.MIN_SPEED), 0, 1);

    // a little bob while riding the flat water
    let riderY = this.y;
    if (this.state === RIDE && this.rampT === 0) riderY += Math.sin(this.time.now / 120) * 2;

    // ease the crouch toward a per-state target (event snaps override briefly)
    let target = 0.35;
    if (this.state === AIR) target = this.grabbing ? 0.6 : 0.5;
    else if (this.state === GRIND) target = 0.45;
    else if (this.state === WIPEOUT) target = 0.7;
    // a Raley is a superman: body fully extended (legs long), the whole rig
    // pitched forward so the board kicks up behind, above the head (see rot).
    const raleyPose = this.state === AIR && this.raley;
    if (raleyPose) target = 0.02;
    // A press rides with the knees bent deeper over the pressing end.
    const pressTarget = this.state === GRIND ? this.pressDir : 0;
    this.pressAmt = Phaser.Math.Linear(this.pressAmt || 0, pressTarget, C.PRESS_LERP);
    if (this.state === GRIND) target += Math.abs(this.pressAmt) * 0.3;
    this.crouch = Phaser.Math.Clamp(Phaser.Math.Linear(this.crouch, target, 0.18), 0, 1);
    // Committing to the Raley is a fast throw; swinging BACK under the bar
    // after release is slower and deliberate — that recovery window is the
    // risk (splash down mid-recovery and you wipe, see evaluateWaterLanding).
    this.raleyAmt = Phaser.Math.Linear(
      this.raleyAmt,
      raleyPose ? 1 : 0,
      raleyPose ? C.RALEY_IN_LERP : C.RALEY_RECOVER_LERP
    );

    // legs pump gently against the water while cruising
    let crouch = this.crouch;
    if (this.state === RIDE && this.rampT === 0) crouch += Math.sin(this.time.now * 0.011) * 0.05;
    crouch = Phaser.Math.Clamp(crouch, 0, 1);

    // upper body leans back against the cable pull (stronger the faster you go);
    // holding an edge leans the rider harder onto that rail as the load builds.
    let leanTarget = 0;
    if (this.state === RIDE) leanTarget = -0.2 * (0.55 + 0.45 * speedRatio);
    else if (this.state === GRIND) leanTarget = -0.12;
    else if (this.state === WIPEOUT) leanTarget = 0.35;
    if (this.state === RIDE) leanTarget += this.edgeDir * this.edgeLoad * C.EDGE_LEAN_MAX;
    this.lean = Phaser.Math.Linear(this.lean, leanTarget, 0.12);

    // applied rotation + spin facing. A SPIN transiently mirrors the whole rig
    // (the rider physically rotates mid-move). In the air, blend in the Raley
    // pitch: the rig tips forward so the torso + arms reach toward the handle and
    // the legs + board swing up behind the head.
    // On a rail the press tips the whole rig: nose press (+) = nose down /
    // tail up, tail press (−) = nose up.
    const rot =
      this.state === RIDE
        ? this.rampAngle
        : this.flipDeg * DEG + this.raleyAmt * C.RALEY_PITCH + this.pressAmt * C.PRESS_PITCH;
    // Signed visual yaw of the chest: 0 = facing the camera, +90 = chest toward
    // the tow (a frontside quarter), 270/−90 = BACK toward the tow (backside).
    // Riding switch shows the rider's back — a standing +180 folded in.
    const yawDeg = this.spinDeg + (this.stance === 1 ? 180 : 0);
    const facing = Math.cos(yawDeg * DEG); // 1 front view … −1 back view
    const side = Math.sin(yawDeg * DEG); // +1 chest to the tow … −1 back to it
    const yawNorm = ((yawDeg % 360) + 360) % 360;
    // Body view for this yaw phase: front → quarter (squashed front) → PROFILE
    // → quarter (squashed back) → back — five distinct reads across a 180
    // instead of one pop at 90°. The profile faces the side the chest points to
    // (mirroring ONLY the body sprite — the rig itself never mirrors: the rope
    // stays toward the tow and the knees keep bending right).
    let bodyTex = "body";
    let bodyFlip = false;
    if (yawNorm >= 130 && yawNorm <= 230) bodyTex = "bodyBack";
    else if (yawNorm > 50 && yawNorm < 310) {
      bodyTex = "bodyProfile";
      bodyFlip = side < 0; // profile texture faces right (toward the tow)
    }
    // Per-part yaw squash: the torso is an ellipse seen from above (a profile
    // is ~55% of the chest width, never a sliver), while the board and the
    // legs DO pinch nearly edge-on at 90° — so mid-spin you see a wide body
    // turning over a knife-edge board, like the real thing.
    const bodyW = Math.hypot(facing, side * C.BODY_SIDE_W);
    const boardW = Math.max(C.BOARD_EDGE_MIN_W, Math.abs(facing));
    const legsW = Math.max(C.LEGS_EDGE_MIN_W, Math.abs(facing));

    // How hard the rider is currently THROWING a spin (0..1). On a real 180 the
    // shoulders send the rotation and the rider folds forward at the waist —
    // this drives that fold + the arm throw, for both grounded and air 180s.
    const spinThrow = Phaser.Math.Clamp(Math.abs(this.spinVel) / C.SPIN_THROW_REF, 0, 1);
    crouch = Phaser.Math.Clamp(crouch + spinThrow * 0.14, 0, 1); // coil into the spin

    // a grab pulls the board (and the locked-in feet) UP toward the body; how
    // far, and where the back hand reaches, depends on which grab is held
    const pose = this.state === AIR && this.grabbing ? this.grabPose() : null;
    const liftTarget = pose ? pose.lift : 0;
    this.tuckLift = Phaser.Math.Linear(this.tuckLift, liftTarget, 0.25);

    // hips ride up/down with the crouch; the board+feet rise on a grab.
    // A press shifts the hips over the pressing end (nose = forward).
    const hipX = -4 + this.pressAmt * 14;
    const baseAnkle = this.boardGeom.bootTopY + 4;
    const hipY = baseAnkle - this.legLen(crouch); // body stays put
    const ankleY = baseAnkle - this.tuckLift; // feet + board lift on a grab

    this.board.y = -this.boardGeom.topLocalY - this.tuckLift;
    this.board.x = 0; // feet stay on the board; the Raley extends via the pitch
    // Nothing is mirrored for stance — the rig always faces the tow (right). The
    // knees are drawn bending forward and stay forward. Switch = a back-view body.
    // Each part carries its own yaw squash (see bodyW/boardW/legsW above).
    this.board.setScale(boardW, 1);
    this.legsGfx.setScale(legsW, 1);
    // While throwing a 180 the torso folds forward at the waist (+bodyRot); the
    // shoulders lead, so the arms are attached at the folded shoulder position.
    const bodyRot = this.lean + spinThrow * C.SPIN_FOLD_MAX;
    this.body.setTexture(bodyTex);
    this.body.setScale(bodyFlip ? -bodyW : bodyW, 1);
    this.body.setPosition(hipX, hipY);
    this.body.setRotation(bodyRot);
    this.drawLegs(hipX, hipY, ankleY, crouch);

    // shoulder position after the fold, then the hand reaching for the handle
    const shoulderX = hipX + this.bodyShoulder.x * Math.cos(bodyRot) - this.bodyShoulder.y * Math.sin(bodyRot);
    const shoulderY = hipY + this.bodyShoulder.x * Math.sin(bodyRot) + this.bodyShoulder.y * Math.cos(bodyRot);
    // gx is board-local; the container's rigFlipX mirrors it for switch/spin.
    const grabPt = pose ? { x: pose.gx, y: ankleY + 2 } : null;
    // Handle pass — DIRECTION-AWARE (signed yaw). Frontside the chest sweeps
    // past the cable and the bar stays out front the whole 180; backside the
    // rider turns his back to the cable, so the bar slides around to the small
    // of the back (passProgress 0→1→0, deepest with the back square to the
    // tow) and swaps hands. Visual only; a grab takes priority.
    const hp = !grabPt ? handlePassState(yawDeg) : { behind: false, hand: 0, passProgress: 0 };
    let handX = shoulderX + 30; // reach forward toward the pull
    let handY = shoulderY - 2;
    if (hp.passProgress > 0) {
      // The bar stays tethered toward the tow, so behind-the-back it sits at
      // the LUMBAR on the tow side (rig +X), low, between the back and the rope.
      handX = Phaser.Math.Linear(handX, hipX + 12, hp.passProgress);
      handY = Phaser.Math.Linear(handY, hipY - 12, hp.passProgress);
    }
    // Deep in the pass the bar + arms are routed BEHIND the rider: drop them
    // under the legs/body so the torso occludes them, restore on top otherwise.
    if (hp.passProgress > 0.5) this.riderC.moveTo(this.armsGfx, 1);
    else this.riderC.bringToTop(this.armsGfx);
    this.drawArms(shoulderX, shoulderY, handX, handY, grabPt, hp.behind, spinThrow);

    this.riderC.setPosition(x, riderY);
    this.riderC.setRotation(rot);
    this.riderC.setScale(S, S); // yaw squash is per-part, not on the container

    // tint cues on the body
    if (this.state === WIPEOUT) this.body.setTint(C.COLORS.bad);
    else if (this.state === GRIND) this.body.setTint(0xfff1a8);
    else this.body.clearTint();

    // spray follows the board on the water; a hard edge throws a bigger rooster
    // tail (more, faster particles as the load builds).
    this.spray.setPosition(x - 36, C.WATER_Y - 4);
    if (this.state === RIDE && this.rampT === 0) {
      this.spray.frequency = Phaser.Math.Linear(60, 18, this.edgeLoad);
    }

    // tow rope: the trolley LEADS ahead of the rider, so the taut rope pulls at
    // a forward angle (the rider is being towed). Hand point is mapped through
    // the container transform so the rope always meets the hands.
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const hwX = x + handX * S * cs - handY * S * sn;
    const hwY = riderY + handX * S * sn + handY * S * cs;
    this.trolley.x = x + 172 + speedRatio * 34; // leads well ahead — a long tow rope
    this.rope.clear();
    this.rope.lineStyle(3, 0xeef6fa, 0.9);
    this.rope.beginPath();
    this.rope.moveTo(this.trolley.x, this.cableY + 5);
    // During a handle pass the line bows around the rider's back rather than
    // running straight to the hand.
    if (hp.passProgress > 0) {
      const midX = (this.trolley.x + hwX) / 2 - hp.passProgress * 26;
      const midY = (this.cableY + 5 + hwY) / 2 + hp.passProgress * 42;
      this.rope.lineTo(midX, midY);
    }
    this.rope.lineTo(hwX, hwY);
    this.rope.strokePath();
  }

  // ==========================================================================
  // Effects
  // ==========================================================================
  popBurst() {
    this.add.particles(C.RIDER_SCREEN_X, this.y, "spark", {
      speed: { min: 120, max: 320 },
      lifespan: 380,
      scale: { start: 1.4, end: 0 },
      quantity: 14,
      tint: C.COLORS.accent,
      emitting: false,
    }).explode(14);
  }

  splash() {
    this.add.particles(C.RIDER_SCREEN_X, C.WATER_Y, "spray", {
      speed: { min: 120, max: 380 },
      angle: { min: 230, max: 310 },
      lifespan: 650,
      scale: { start: 1.2, end: 0 },
      quantity: 26,
      tint: C.COLORS.foam,
      emitting: false,
    }).explode(26);
  }

  // ==========================================================================
  // HUD events
  // ==========================================================================
  emitScore() {
    this.game.events.emit("score", this.score);
  }
  emitCharge() {
    // On a rail the bar shows the pop charge; on the water it shows the EDGE
    // load and which side (−1 heelside / +1 toeside) is being held.
    const onRail = this.state === GRIND;
    const ratio = onRail ? this.chargeRatio() : this.edgeLoad;
    this.game.events.emit("charge", ratio, this.charging, onRail ? 0 : this.edgeDir);
  }
  emitSpeed() {
    const ratio = (this.speed - C.MIN_SPEED) / (C.MAX_SPEED - C.MIN_SPEED);
    this.game.events.emit("speed", Phaser.Math.Clamp(ratio, 0, 1));
  }
  emitCombo() {
    if (this.multiplier > 1 && this.multiplier > this._lastMult) audio.play("comboUp");
    this._lastMult = this.multiplier;
    this.game.events.emit("combo", this.multiplier);
  }
  emitTime() {
    this.game.events.emit("time", Math.max(0, this.timeLeft));
  }

  // End the run: tear down the HUD overlay and hand the final score to GameOver.
  endRun() {
    this.scene.stop("Hud");
    this.summary.score = this.score;
    this.scene.start("GameOver", {
      score: this.score,
      summary: this.summary,
      mode: this.runMode,
    });
  }
}
