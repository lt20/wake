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

    // Controls hint ----------------------------------------------------------
    this.hint = this.add
      .text(
        C.VIRTUAL_WIDTH / 2,
        C.VIRTUAL_HEIGHT - 40,
        "TAP = pop  •  swipe ↕ = flips  •  swipe ↔ = spins  •  HOLD (Shift) = grab  •  land upright!",
        { ...font, fontSize: "20px", color: "#bfe9f0" }
      )
      .setOrigin(0.5);

    // Contextual air prompt — makes the grab obvious while airborne
    this.airPrompt = this.add
      .text(C.VIRTUAL_WIDTH / 2, C.VIRTUAL_HEIGHT / 2 + 80, "HOLD / Shift = GRAB  ·  release before landing", {
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
    ["score", "state", "combo", "trick", "speed", "message", "time"].forEach((e) =>
      ev.off(e)
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
}
