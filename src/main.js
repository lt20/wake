import Phaser from "phaser";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "./config.js";
import BootScene from "./scenes/BootScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import HudScene from "./scenes/HudScene.js";
import GameOverScene from "./scenes/GameOverScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#061821",
  width: VIRTUAL_WIDTH,
  height: VIRTUAL_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    preserveDrawingBuffer: true,
  },
  scene: [BootScene, MenuScene, GameScene, HudScene, GameOverScene],
};

window.addEventListener("error", (e) => {
  window.__err = (e.error && e.error.stack) || e.message;
});

const game = new Phaser.Game(config);
window.__game = game;

// The FIT scale manager can latch onto a 0-sized parent if it measures before
// layout settles. Force a refresh once the page is ready and on every resize.
const refresh = () => game.scale.refresh();
window.addEventListener("resize", refresh);
window.addEventListener("orientationchange", refresh);
game.events.once("ready", () => {
  refresh();
  setTimeout(refresh, 60);
});

// Correct the FIT sizing the moment the container actually gets laid out
// (mobile dynamic viewport / dvh can report 0 on first paint).
const parent = document.getElementById("game");
if (parent && "ResizeObserver" in window) {
  new ResizeObserver(refresh).observe(parent);
}
