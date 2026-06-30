import Phaser from "phaser";
import * as C from "../config.js";

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

    // Best score — placeholder until T3 persists it.
    this.add
      .text(W / 2, H * 0.58, "MEILLEUR : --", {
        ...font,
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffd23f",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(W / 2, H * 0.74, "TAP / SPACE pour rider", {
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

    const start = () => this.startRun();
    this.input.on("pointerdown", start);
    this.input.keyboard.on("keydown-SPACE", start);
    this.input.keyboard.on("keydown-ENTER", start);
  }

  startRun() {
    this.scene.start("Game");
    this.scene.launch("Hud");
  }
}
