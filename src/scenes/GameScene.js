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

  create() {
    // Pull the camera back so the rider sits further away and the tow rope reads
    // longer. Backgrounds are drawn oversized (by these margins) to fill the
    // reveal. Gameplay math is in world units and is unaffected by the zoom.
    this.cameras.main.setZoom(C.CAMERA_ZOOM);
    this.mx = Math.ceil((C.VIRTUAL_WIDTH / 2) * (1 / C.CAMERA_ZOOM - 1)) + 24;
    this.my = Math.ceil((C.VIRTUAL_HEIGHT / 2) * (1 / C.CAMERA_ZOOM - 1)) + 24;

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
    this.rampT = 0; // 0 on flat water, →1 climbing a kicker to the lip
    this.rampAngle = 0;
    this.prevState = RIDE;

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
    this.events.once("shutdown", () => audio.stopHum());

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
    this.body = this.add.image(0, 0, "body").setOrigin(bodyOrigin.x, bodyOrigin.y);

    this.riderC = this.add
      .container(C.RIDER_SCREEN_X, C.WATER_Y, [this.board, this.legsGfx, this.body, this.armsGfx])
      .setDepth(11);

    this.crouch = 0.35; // 0 = legs extended, 1 = deeply bent
    this.lean = 0; // upper-body lean against the cable pull (radians)
    this.tuckLift = 0; // how far the board is pulled up toward the body (grab)

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
    const def = pickModule(() => Phaser.Math.RND.frac(), this.difficulty);
    const baseX = this.nextSpawnX;

    // Each segment is its own interactive (or decorative) piece at its offset,
    // so composites reuse the per-piece kicker / rail physics directly.
    for (const seg of def.segments) {
      this.spawnSegment(def, seg, baseX + seg.offset);
    }

    const footprint = moduleFootprint(def);
    const d = this.difficulty;
    this.nextSpawnX = baseX + footprint + Phaser.Math.Between(d.gapMin, d.gapMax);
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
    this.gesture = { active: false, sx: 0, sy: 0, t0: 0, flicked: false };

    this.input.on("pointerdown", (p) => {
      audio.resume(); // unlock audio on the first gesture
      this.gesture.active = true;
      this.gesture.sx = p.x;
      this.gesture.sy = p.y;
      this.gesture.t0 = this.time.now;
      this.gesture.flicked = false;
      // on the ground, a held press loads the pop (released on pointerup)
      this.beginCharge();
    });

    this.input.on("pointermove", (p) => {
      if (!this.gesture.active) return;
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

    this.input.on("pointerup", () => {
      if (!this.gesture.active) return;
      // release a held load into a pop (a quick tap = tiny load = small hop)
      if (this.charging && !this.gesture.flicked) this.releasePop();
      this.gesture.active = false;
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

  // Release the loaded pop. Velocity scales with how long the load was held:
  // a quick tap barely hops (enough to step onto a slide), a full load launches
  // high. Off a kicker lip the pop is bigger and can be "perfect".
  releasePop() {
    const r = this.chargeRatio();
    this.lastPopRelease = this.time.now / 1000;

    if (this.state === GRIND) {
      this.popOffRail(Phaser.Math.Linear(C.GRIND_POP_MIN, C.GRIND_POP_MAX, r));
    } else if (this.state === RIDE) {
      if (this.rampT > 0.02) {
        // on a kicker face — a load released near the lip pops big + perfect
        const perfect = this.rampT >= 0.72;
        const v =
          Phaser.Math.Linear(C.KICKER_POP_MIN, C.KICKER_POP_MAX, r) +
          (perfect ? C.PERFECT_POP_BONUS : 0);
        this.launch(v, perfect);
      } else {
        this.launch(Phaser.Math.Linear(C.POP_MIN_VELOCITY, C.POP_MAX_VELOCITY, r), false);
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

  // The grab direction held in the air: E/S/D/X grab keys take priority,
  // otherwise the current pointer's drag offset from where the hold began.
  readGrabDir() {
    const k = this.keys;
    let x = (k.grabRight.isDown ? 1 : 0) - (k.grabLeft.isDown ? 1 : 0);
    let y = (k.grabDown.isDown ? 1 : 0) - (k.grabUp.isDown ? 1 : 0);
    if (x === 0 && y === 0 && this.gesture.active && !this.gesture.flicked) {
      const p = this.input.activePointer;
      x = p.x - this.gesture.sx;
      y = p.y - this.gesture.sy;
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
  launch(velocity, perfect) {
    this.state = AIR;
    this.vy = -velocity;
    this.crouch = 0; // legs snap straight to push off
    this.activeRail = null;
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
    this.state = AIR;
    this.vy = -velocity;
    this.resetSurfaceSpin();
    audio.play("pop");
  }

  land(clean, label) {
    if (clean) {
      // award the rotation itself (flips + spins), then the landing bonus
      const { flips, spins } = countRotations(this.flipDeg, this.spinDeg);
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
      });
      this.multiplier += 1;
      this.comboTimer = C.COMBO_DECAY;
      audio.play("land");
      if (name) this.game.events.emit("trick", name, gained, this.multiplier);
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
    this.wipeTimer = 0.85;
    this.crouch = 1; // buckle on impact
    this.speed = C.MIN_SPEED;
    this.multiplier = 1;
    this.pending = 0;
    this.trickParts = [];
    this.grabbing = false;
    this.charging = false;
    this.stance = 0; // a bail resets you to a regular stance
    this.splash();
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

  // Integrate a flat (yaw-only) spin while on the water or a module, banking
  // points + a trick-feed entry per completed 180. This path never wipes out.
  tickSurfaceSpin(dt) {
    if (this.state !== RIDE && this.state !== GRIND) return;
    if (this.spinVel === 0) return;

    this.spinDeg += this.spinVel * dt;
    this.surfaceSpinDeg += Math.abs(this.spinVel) * dt;
    this.spinVel = Phaser.Math.Linear(this.spinVel, 0, C.SURFACE_SPIN_FRICTION * dt);
    if (Math.abs(this.spinVel) < 2) this.spinVel = 0;

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

    // scroll the world
    this.scrollX += this.speed * dt;

    // climb toward (and recover after a bail relative to) the current speed target
    const speedTarget = this.difficulty.speedTarget;
    if (this.state !== WIPEOUT && this.speed < speedTarget) {
      this.speed = Math.min(speedTarget, this.speed + C.SPEED_RECOVER * dt);
      this.emitSpeed();
    }

    this.updateState(dt, time);
    if (this.state !== this.prevState) {
      this.game.events.emit("state", this.state);
      this.prevState = this.state;
    }
    this.positionFeatures();
    this.recycleFeatures();
    this.updateBackground(dt);
    this.updateRiderVisual();
    this.emitSpeed();
  }

  updateState(dt, time) {
    switch (this.state) {
      case RIDE:
        this.grabbing = false;
        this.tickCharge(dt); // build the loaded pop while held
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
        this.vy += C.GRAVITY * dt;
        this.y += this.vy * dt;

        // rotation is HELD, not flicked: an arrow spins/flips while down and
        // stops the instant it is released (velocity snaps to 0).
        const kx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
        const ky = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
        this.spinVel = kx * C.ROT_RATE;
        this.flipVel = ky * C.ROT_RATE;
        this.flipDeg += this.flipVel * dt;
        this.spinDeg += this.spinVel * dt;

        // grab: an E/S/D/X key held, or a pointer held without flicking
        const holding =
          this.grabKeyDown() ||
          (this.gesture.active && !this.gesture.flicked && time - this.gesture.t0 > C.HOLD_MIN_TIME);
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
        // reached the lip — pop! releasing a held load right here fires a big,
        // "perfect" pop; rolling off without a load gives a small base pop.
        if (this.charging) this.releasePop();
        else this.launch(C.KICKER_POP_MIN, false);
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
    const { flipErr, spinErr } = landingError(this.flipDeg, this.spinDeg);
    // The sole wipeout path: still grabbing, or not upright enough on impact.
    if (
      wipesOutOnWaterLanding(
        this.grabbing,
        flipErr,
        spinErr,
        C.LAND_FLIP_TOLERANCE,
        C.LAND_SPIN_TOLERANCE
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
    this.hillsFar.tilePositionX += this.speed * dt * 0.15;
    this.hills.tilePositionX += this.speed * dt * 0.3;

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
    leg(this.boardGeom.frontFootX, shorts, skin, 20); // front leg
    g.fillStyle(shorts, 1);
    g.fillRoundedRect(hipX - 13, hipY - 8, 26, 16, 7); // hips/seat
  }

  // Procedural arms: reach from the shoulders to the handle. Because the hand
  // point leads toward the cable, the arms naturally follow the handle as the
  // rider spins (the whole rig mirrors) and flips (the whole rig rotates).
  drawArms(sx, sy, hx, hy, grabPt) {
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

  updateRiderVisual() {
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
    this.crouch = Phaser.Math.Clamp(Phaser.Math.Linear(this.crouch, target, 0.18), 0, 1);

    // legs pump gently against the water while cruising
    let crouch = this.crouch;
    if (this.state === RIDE && this.rampT === 0) crouch += Math.sin(this.time.now * 0.011) * 0.05;
    crouch = Phaser.Math.Clamp(crouch, 0, 1);

    // upper body leans back against the cable pull (stronger the faster you go)
    let leanTarget = 0;
    if (this.state === RIDE) leanTarget = -0.2 * (0.55 + 0.45 * speedRatio);
    else if (this.state === GRIND) leanTarget = -0.12;
    else if (this.state === WIPEOUT) leanTarget = 0.35;
    this.lean = Phaser.Math.Linear(this.lean, leanTarget, 0.12);

    // applied rotation + spin facing. A spin mirrors the WHOLE rig (the rider
    // turns around mid-air); the persistent switch stance is handled separately.
    const rot = this.state === RIDE ? this.rampAngle : this.flipDeg * DEG;
    const facing = Math.cos(this.spinDeg * DEG); // -1..1
    const sxFace = Math.max(0.28, Math.abs(facing)) * Math.sign(facing || 1);

    // Switch stance keeps the torso, arms and tow handle facing forward (the
    // rider is still towed forward) and swaps ONLY the feet — so just the board
    // and legs mirror. This is the correct switch pose (front foot changes side).
    const stanceFlip = this.stance ? -1 : 1;

    // a grab pulls the board (and the locked-in feet) UP toward the body; how
    // far, and where the back hand reaches, depends on which grab is held
    const pose = this.state === AIR && this.grabbing ? this.grabPose() : null;
    const liftTarget = pose ? pose.lift : 0;
    this.tuckLift = Phaser.Math.Linear(this.tuckLift, liftTarget, 0.25);

    // hips ride up/down with the crouch; the board+feet rise on a grab
    const hipX = -4;
    const baseAnkle = this.boardGeom.bootTopY + 4;
    const hipY = baseAnkle - this.legLen(crouch); // body stays put
    const ankleY = baseAnkle - this.tuckLift; // feet + board lift on a grab

    this.board.y = -this.boardGeom.topLocalY - this.tuckLift;
    this.board.setScale(stanceFlip, 1); // swap the accent (front) foot in switch
    this.legsGfx.setScale(stanceFlip, 1); // legs cross to the swapped feet
    this.body.setPosition(hipX, hipY);
    this.body.setRotation(this.lean);
    this.drawLegs(hipX, hipY, ankleY, crouch);

    // shoulder position after the lean, then the hand reaching for the handle
    const shoulderX = hipX + this.bodyShoulder.x * Math.cos(this.lean) - this.bodyShoulder.y * Math.sin(this.lean);
    const shoulderY = hipY + this.bodyShoulder.x * Math.sin(this.lean) + this.bodyShoulder.y * Math.cos(this.lean);
    const handX = shoulderX + 30; // reach forward toward the pull
    const handY = shoulderY - 2;
    const grabPt = pose ? { x: pose.gx * stanceFlip, y: ankleY + 2 } : null;
    this.drawArms(shoulderX, shoulderY, handX, handY, grabPt);

    this.riderC.setPosition(x, riderY);
    this.riderC.setRotation(rot);
    this.riderC.setScale(S * sxFace, S);

    // tint cues on the body
    if (this.state === WIPEOUT) this.body.setTint(C.COLORS.bad);
    else if (this.state === GRIND) this.body.setTint(0xfff1a8);
    else this.body.clearTint();

    // spray follows the board on the water
    this.spray.setPosition(x - 36, C.WATER_Y - 4);

    // tow rope: the trolley LEADS ahead of the rider, so the taut rope pulls at
    // a forward angle (the rider is being towed). Hand point is mapped through
    // the container transform so the rope always meets the hands.
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const hwX = x + handX * S * sxFace * cs - handY * S * sn;
    const hwY = riderY + handX * S * sxFace * sn + handY * S * cs;
    this.trolley.x = x + 172 + speedRatio * 34; // leads well ahead — a long tow rope
    this.rope.clear();
    this.rope.lineStyle(3, 0xeef6fa, 0.9);
    this.rope.beginPath();
    this.rope.moveTo(this.trolley.x, this.cableY + 5);
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
    this.game.events.emit("charge", this.chargeRatio(), this.charging);
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
    this.scene.start("GameOver", { score: this.score });
  }
}
