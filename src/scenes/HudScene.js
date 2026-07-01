import Phaser from "phaser";
import * as C from "../config.js";

// Overlay scene: score, combo multiplier, trick feed, speed bar, messages.
export default class HudScene extends Phaser.Scene {
  constructor() {
    super({ key: "Hud", active: false });
  }

  create() {
    const W = C.VIRTUAL_WIDTH;

    const font = {
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
    };

    // Score ------------------------------------------------------------------
    this.scoreLabel = this.add
      .text(36, 30, "SCORE", { ...font, fontSize: "22px", color: "#9fe9e0" })
      .setOrigin(0, 0);
    this.scoreText = this.add
      .text(36, 54, "0", { ...font, fontSize: "56px", fontStyle: "bold" })
      .setOrigin(0, 0);

    // Run timer (time-attack) ------------------------------------------------
    this.timeText = this.add
      .text(W / 2, 30, this.formatTime(C.RUN_DURATION), {
        ...font,
        fontSize: "52px",
        fontStyle: "bold",
        stroke: "#06222b",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);

    // Combo multiplier -------------------------------------------------------
    this.multText = this.add
      .text(W - 36, 40, "", { ...font, fontSize: "60px", fontStyle: "bold", color: "#ffd23f" })
      .setOrigin(1, 0);

    // Trick popup feed -------------------------------------------------------
    this.trickText = this.add
      .text(W / 2, 150, "", {
        ...font,
        fontSize: "40px",
        fontStyle: "bold",
        color: "#33d6c8",
        align: "center",
        stroke: "#06222b",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Rotation indicator (air only) — a small dial showing how close the board
    // is to an upright landing. Green within tolerance, red otherwise.
    this.rotCenter = { x: W / 2, y: 250 };
    this.rotR = 34;
    this.rotGfx = this.add.graphics().setVisible(false);

    // Big center message -----------------------------------------------------
    this.msgText = this.add
      .text(W / 2, C.VIRTUAL_HEIGHT / 2 - 60, "", {
        ...font,
        fontSize: "84px",
        fontStyle: "bold",
        align: "center",
        stroke: "#06222b",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Speed bar --------------------------------------------------------------
    this.add
      .text(36, C.VIRTUAL_HEIGHT - 58, "SPEED", { ...font, fontSize: "18px", color: "#9fe9e0" })
      .setOrigin(0, 0);
    this.add
      .rectangle(120, C.VIRTUAL_HEIGHT - 48, 220, 16, 0x06222b)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x2f6b78);
    this.speedFill = this.add
      .rectangle(122, C.VIRTUAL_HEIGHT - 46, 0, 12, C.COLORS.accent)
      .setOrigin(0, 0);

    // Load / pop charge bar (surface only) — fills while the pop button is held.
    // A quick tap barely moves it (small hop); a long hold fills it for big air.
    this.chargeW = 300;
    const cy = C.VIRTUAL_HEIGHT - 96;
    this.chargeLabel = this.add
      .text(W / 2, cy - 22, "LOAD", { ...font, fontSize: "16px", color: "#9fe9e0" })
      .setOrigin(0.5)
      .setVisible(false);
    this.chargeBarBg = this.add
      .rectangle(W / 2, cy, this.chargeW + 6, 22, 0x06222b)
      .setStrokeStyle(2, 0x2f6b78)
      .setVisible(false);
    this.chargeFill = this.add
      .rectangle(W / 2 - this.chargeW / 2, cy, 0, 14, C.COLORS.accent)
      .setOrigin(0, 0.5)
      .setVisible(false);
    // tick marking the "just a tap" threshold vs a real load
    this.chargeTick = this.add
      .rectangle(W / 2 - this.chargeW / 2 + this.chargeW * 0.12, cy, 2, 16, 0xffffff, 0.5)
      .setVisible(false);

    // Controls hint ----------------------------------------------------------
    this.hint = this.add
      .text(
        C.VIRTUAL_WIDTH / 2,
        C.VIRTUAL_HEIGHT - 40,
        "HOLD SPACE = load & pop  •  hold ↑↓ = flips  •  hold ←→ = spins  •  E/S/D/X = grabs  •  land upright!",
        { ...font, fontSize: "20px", color: "#bfe9f0" }
      )
      .setOrigin(0.5);

    // Contextual air prompt — makes the grab obvious while airborne
    this.airPrompt = this.add
      .text(C.VIRTUAL_WIDTH / 2, C.VIRTUAL_HEIGHT / 2 + 80, "E S D X = GRAB  ·  release before landing", {
        ...font,
        fontSize: "26px",
        fontStyle: "bold",
        color: "#ffd23f",
        stroke: "#06222b",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.bindEvents();

    // fade the hint out after a few seconds
    this.time.delayedCall(6500, () => {
      this.tweens.add({ targets: this.hint, alpha: 0.25, duration: 800 });
    });
  }

  bindEvents() {
    const ev = this.game.events;

    // The HUD is launched/stopped once per run; clear any listeners left over
    // from a previous run so handlers don't accumulate on the global emitter.
    ["score", "state", "combo", "trick", "speed", "message", "time", "rotation", "charge"].forEach(
      (e) => ev.off(e)
    );

    ev.on("score", (s) => {
      this.scoreText.setText(this.format(s));
    });

    ev.on("time", (sec) => {
      this.timeText.setText(this.formatTime(sec));
      this.timeText.setColor(sec <= 10 ? "#ff4d6d" : "#ffffff");
    });

    ev.on("state", (state) => {
      const inAir = state === "air";
      this.tweens.add({
        targets: this.airPrompt,
        alpha: inAir ? 1 : 0,
        duration: 150,
      });
      if (!inAir) this.rotGfx.setVisible(false); // dial only shows in the air
    });

    ev.on("rotation", (r) => this.drawRotation(r));

    ev.on("charge", (ratio, active) => {
      this.chargeLabel.setVisible(active);
      this.chargeBarBg.setVisible(active);
      this.chargeFill.setVisible(active);
      this.chargeTick.setVisible(active);
      this.chargeFill.width = this.chargeW * ratio;
      this.chargeFill.fillColor =
        ratio > 0.85 ? 0xff4d6d : ratio > 0.55 ? 0xffd23f : C.COLORS.accent;
    });

    ev.on("combo", (mult) => {
      if (mult > 1) {
        this.multText.setText("x" + mult);
        this.tweens.add({
          targets: this.multText,
          scale: { from: 1.4, to: 1 },
          duration: 220,
          ease: "Back.out",
        });
      } else {
        this.multText.setText("");
      }
    });

    ev.on("trick", (name, gained) => {
      this.trickText.setText(`${name}\n+${this.format(gained)}`);
      this.trickText.setScale(1);
      this.trickText.setAlpha(1);
      this.tweens.killTweensOf(this.trickText);
      this.tweens.add({
        targets: this.trickText,
        y: { from: 150, to: 120 },
        alpha: { from: 1, to: 0 },
        duration: 1100,
        ease: "Cubic.out",
      });
    });

    ev.on("speed", (ratio) => {
      this.speedFill.width = 216 * ratio;
      this.speedFill.fillColor = ratio > 0.66 ? 0xffd23f : C.COLORS.accent;
    });

    ev.on("message", (text, duration = 700, bad = false) => {
      this.msgText.setText(text);
      this.msgText.setColor(bad ? "#ff4d6d" : "#ffffff");
      this.tweens.killTweensOf(this.msgText);
      this.msgText.setAlpha(1);
      this.msgText.setScale(1.3);
      this.tweens.add({
        targets: this.msgText,
        scale: 1,
        duration: 200,
        ease: "Back.out",
      });
      this.tweens.add({
        targets: this.msgText,
        alpha: 0,
        delay: duration,
        duration: 350,
      });
    });
  }

  format(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  formatTime(sec) {
    const s = Math.ceil(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  // Draw the air-only rotation dial: a needle deflecting from straight-up as the
  // landing error grows, coloured green within tolerance and red outside it.
  drawRotation(r) {
    const g = this.rotGfx;
    const { x, y } = this.rotCenter;
    const R = this.rotR;
    const color = r.ok ? 0x33d6c8 : 0xff4d6d;
    // normalize the worst-axis error (flip max 180°, spin max 90°) to 0..1
    const norm = Math.min(1, Math.max(r.flipErr / 180, r.spinErr / 90));
    const ang = -Math.PI / 2 + norm * Math.PI; // straight up at 0, → right at 1

    g.setVisible(true);
    g.clear();
    // backdrop + fill tinted by ok/not
    g.fillStyle(0x06222b, 0.55);
    g.fillCircle(x, y, R);
    g.fillStyle(color, r.ok ? 0.22 : 0.14);
    g.fillCircle(x, y, R - 3);
    g.lineStyle(3, 0x06222b, 0.9);
    g.strokeCircle(x, y, R);
    // upright target tick at the top
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.moveTo(x, y - R - 6);
    g.lineTo(x, y - R + 4);
    g.strokePath();
    // needle
    g.lineStyle(5, color, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * (R - 6), y + Math.sin(ang) * (R - 6));
    g.strokePath();
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 4);
  }
}
