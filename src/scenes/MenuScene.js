import Phaser from "phaser";
import * as C from "../config.js";
import { loadBest, loadProfile } from "../storage.js";
import { dailyChallengeFor } from "../progression.js";
import { audio } from "../audio.js";
import { ASSETS_ENABLED, AUDIO_SAMPLES } from "../assets.js";

// Title screen. Shows the best score (placeholder "--" until T3 wires storage)
// and starts a run on tap / space / enter.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create() {
    const W = C.VIRTUAL_WIDTH;
    const H = C.VIRTUAL_HEIGHT;
    const font = { fontFamily: "Arial, sans-serif", color: "#ffffff" };

    this.add.image(0, 0, "sky").setOrigin(0, 0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x06222b, 0.35).setOrigin(0, 0);

    this.add
      .text(W / 2, H * 0.3, "CABLE RUSH", {
        ...font,
        fontSize: "104px",
        fontStyle: "bold",
        color: "#33d6c8",
        stroke: "#06222b",
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.44, "wakeboard cable-park tricks", {
        ...font,
        fontSize: "28px",
        color: "#bfe9f0",
      })
      .setOrigin(0.5);

    // Best score + coins, persisted across sessions.
    const best = loadBest();
    const profile = loadProfile();
    this.add
      .text(W / 2, H * 0.56, `MEILLEUR : ${best.toLocaleString("en-US")}`, {
        ...font,
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffd23f",
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H * 0.63, `PIÈCES : ${profile.coins.toLocaleString("en-US")}`, {
        ...font,
        fontSize: "24px",
        color: "#9fe9e0",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(W / 2, H * 0.73, "TAP / SPACE pour rider", {
        ...font,
        fontSize: "40px",
        fontStyle: "bold",
        stroke: "#06222b",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // Daily challenge: a deterministic, shared layout seeded by today's date.
    this.add
      .text(W / 2, H * 0.8, "D = Défi du jour (même run pour tous)", {
        ...font,
        fontSize: "22px",
        color: "#bfe9f0",
      })
      .setOrigin(0.5);
    this.input.keyboard.on("keydown-D", () => this.startRun("daily"));

    // Sound toggle (M), persisted across sessions.
    this.muteText = this.add
      .text(W / 2, H * 0.88, "", { ...font, fontSize: "24px", color: "#bfe9f0" })
      .setOrigin(0.5);
    this.refreshMuteLabel();
    this.input.keyboard.on("keydown-M", () => {
      audio.resume();
      audio.toggleMute();
      this.refreshMuteLabel();
    });

    const start = () => this.startRun();
    this.input.on("pointerdown", start);
    this.input.keyboard.on("keydown-SPACE", start);
    this.input.keyboard.on("keydown-ENTER", start);
  }

  refreshMuteLabel() {
    this.muteText.setText(`SON : ${audio.isMuted() ? "OFF" : "ON"}  —  M`);
  }

  startRun(mode = "free") {
    audio.resume(); // unlock audio on this user gesture
    // Load real audio samples (if any exist) on this first gesture; a no-op
    // otherwise, so the synth fallback keeps playing.
    if (ASSETS_ENABLED) audio.loadSamplesFrom(AUDIO_SAMPLES);
    let data = { mode: "free" };
    if (mode === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      data = { mode: "daily", seed: dailyChallengeFor(today).seed };
    }
    this.scene.start("Game", data);
    this.scene.launch("Hud");
  }
}
