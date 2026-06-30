import Phaser from "phaser";
import * as C from "../config.js";

// End-of-run screen. Shows the final score (and best score — placeholder until
// T3). Tap / space / enter replays a fresh run; M returns to the menu.
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  init(data) {
    this.finalScore = (data && data.score) || 0;
  }

  create() {
    const W = C.VIRTUAL_WIDTH;
    const H = C.VIRTUAL_HEIGHT;
    const font = { fontFamily: "Arial, sans-serif", color: "#ffffff" };

    this.add.image(0, 0, "sky").setOrigin(0, 0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x06222b, 0.5).setOrigin(0, 0);

    this.add
      .text(W / 2, H * 0.22, "RUN TERMINÉ", {
        ...font,
        fontSize: "84px",
        fontStyle: "bold",
        color: "#33d6c8",
        stroke: "#06222b",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.4, "SCORE", { ...font, fontSize: "30px", color: "#9fe9e0" })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H * 0.5, this.format(this.finalScore), {
        ...font,
        fontSize: "96px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Best score — placeholder until T3 persists it.
    this.add
      .text(W / 2, H * 0.63, "MEILLEUR : --", {
        ...font,
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffd23f",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(W / 2, H * 0.78, "TAP pour rejouer", {
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

    this.add
      .text(W / 2, H * 0.88, "M = menu", { ...font, fontSize: "24px", color: "#bfe9f0" })
      .setOrigin(0.5);

    const replay = () => this.replay();
    this.input.on("pointerdown", replay);
    this.input.keyboard.on("keydown-SPACE", replay);
    this.input.keyboard.on("keydown-ENTER", replay);
    this.input.keyboard.on("keydown-M", () => this.scene.start("Menu"));
  }

  replay() {
    this.scene.start("Game");
    this.scene.launch("Hud");
  }

  format(n) {
    return Math.round(n).toLocaleString("en-US");
  }
}
