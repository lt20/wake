import Phaser from "phaser";
import { COLORS, VIRTUAL_WIDTH } from "../config.js";

// Generates every visual procedurally so the game runs with zero asset files.
// Each texture is hand-drawn with Graphics then baked. Swap for real art later.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    this.makeBody();
    this.makeBodyViews();
    this.makeBoard();
    this.makeKicker();
    this.makeRail();
    this.makeParticles();
    this.makeSky();
    this.makeHills();
    this.makeCloud();

    this.scene.start("Game");
    this.scene.launch("Hud");
  }

  g() {
    return this.make.graphics({ x: 0, y: 0, add: false });
  }

  // The wakeboarder's UPPER BODY only (torso + arms + head + handle). Legs are
  // drawn procedurally each frame so they can flex/extend. Leaned-back stance,
  // both arms out front gripping the handle. Origin is the HIP (bottom-center),
  // so the body can be hung off the top of the procedural legs.
  makeBody() {
    const W = 96;
    const H = 130;
    const g = this.g();

    const skin = 0xe7b48c;
    const hair = 0x2c2118;
    const vest = 0x223a4c;
    const vestAccent = COLORS.rider;

    // neutral, near-vertical torso (lean is applied dynamically at runtime).
    const hip = [48, 122];
    const shoulder = [48, 50];
    const head = [48, 26];

    // torso / life vest
    g.fillStyle(vest, 1);
    g.beginPath();
    g.moveTo(shoulder[0] - 16, shoulder[1] - 4);
    g.lineTo(shoulder[0] + 16, shoulder[1] - 4);
    g.lineTo(hip[0] + 13, hip[1]);
    g.lineTo(hip[0] - 13, hip[1]);
    g.closePath();
    g.fillPath();
    // accent panel down the front
    g.fillStyle(vestAccent, 1);
    g.fillRoundedRect(shoulder[0] - 9, shoulder[1], 18, 52, 6);
    g.fillStyle(0xffffff, 0.16);
    g.fillRoundedRect(shoulder[0] - 4, shoulder[1] + 4, 4, 44, 2);

    // neck
    g.lineStyle(12, skin, 1);
    g.beginPath();
    g.moveTo(shoulder[0], shoulder[1]);
    g.lineTo(head[0], head[1] + 10);
    g.strokePath();

    // head + hair
    g.fillStyle(skin, 1);
    g.fillCircle(head[0], head[1], 14);
    g.fillStyle(hair, 1);
    g.slice(head[0], head[1] - 1, 15, Phaser.Math.DEG_TO_RAD * 168, Phaser.Math.DEG_TO_RAD * 372, false);
    g.fillPath();
    g.fillTriangle(head[0] + 7, head[1] - 12, head[0] + 20, head[1] - 18, head[0] + 14, head[1] - 1);

    g.generateTexture("body", W, H);
    g.destroy();

    // origin at the hip; shoulder offset (from hip) is where the arms attach
    this.registry.set("bodyOrigin", { x: hip[0] / W, y: hip[1] / H });
    this.registry.set("bodyShoulder", { x: shoulder[0] - hip[0], y: shoulder[1] - hip[1] });
  }

  // FRONT- and BACK-facing torso+head, same canvas/geometry/origin as makeBody so
  // the body sprite can swap between "body" / "bodyFront" / "bodyBack" mid-spin.
  // Front = chest + face visible; back = plain vest + back of the head (hair).
  makeBodyViews() {
    const W = 96;
    const H = 130;
    const skin = 0xe7b48c;
    const hair = 0x2c2118;
    const vest = 0x223a4c;
    const vestDk = 0x162a38;
    const vestAccent = COLORS.rider;
    const hip = [48, 122];
    const shoulder = [48, 50];
    const head = [48, 26];

    // wider, symmetric vest trapezoid shared by both facing views
    const torso = (g) => {
      g.fillStyle(vest, 1);
      g.beginPath();
      g.moveTo(shoulder[0] - 20, shoulder[1] - 4);
      g.lineTo(shoulder[0] + 20, shoulder[1] - 4);
      g.lineTo(hip[0] + 15, hip[1]);
      g.lineTo(hip[0] - 15, hip[1]);
      g.closePath();
      g.fillPath();
      // shoulder straps
      g.fillStyle(vestDk, 1);
      g.fillRoundedRect(shoulder[0] - 20, shoulder[1] - 4, 9, 11, 3);
      g.fillRoundedRect(shoulder[0] + 11, shoulder[1] - 4, 9, 11, 3);
    };
    const neck = (g) => {
      g.lineStyle(13, skin, 1);
      g.beginPath();
      g.moveTo(shoulder[0], shoulder[1] - 2);
      g.lineTo(head[0], head[1] + 10);
      g.strokePath();
    };

    // FRONT
    const f = this.g();
    torso(f);
    // zip panel + highlight down the chest
    f.fillStyle(vestAccent, 1);
    f.fillRoundedRect(shoulder[0] - 7, shoulder[1], 14, 62, 5);
    f.fillStyle(0xffffff, 0.14);
    f.fillRoundedRect(shoulder[0] - 3, shoulder[1] + 4, 3, 52, 2);
    neck(f);
    // head: hair crown up, face below
    f.fillStyle(hair, 1);
    f.fillCircle(head[0], head[1] - 2, 15);
    f.fillStyle(skin, 1);
    f.fillCircle(head[0], head[1] + 2, 13);
    f.generateTexture("bodyFront", W, H);
    f.destroy();

    // BACK
    const b = this.g();
    torso(b);
    // spine seam + yoke line on a plain back
    b.fillStyle(vestDk, 1);
    b.fillRoundedRect(shoulder[0] - 4, shoulder[1], 8, 62, 3);
    b.fillStyle(0x2d4a5e, 1);
    b.fillRect(shoulder[0] - 18, shoulder[1] + 16, 36, 4);
    neck(b);
    // head: all hair (back of the skull), tiny nape of skin at the base
    b.fillStyle(skin, 1);
    b.fillCircle(head[0], head[1] + 11, 7);
    b.fillStyle(hair, 1);
    b.fillCircle(head[0], head[1], 15);
    b.generateTexture("bodyBack", W, H);
    b.destroy();
  }

  // A proper wakeboard: long, thin, with upturned tips (spatulas) at BOTH ends
  // and twin fins. Boots are baked on (feet locked) at a wide stance — the
  // FRONT boot is accent-coloured so the player can read which foot leads.
  makeBoard() {
    const W = 200;
    const H = 84;
    const cx = 100;
    const surf = 50; // board top surface inside the texture
    const thick = 8;
    const x0 = 16;
    const x1 = 184; // board spans x0..x1
    const tipRise = 15;
    const backX = cx - 31; // wide stance
    const frontX = cx + 31;
    const g = this.g();

    const topAt = (x) => {
      const t = (x - cx) / ((x1 - x0) / 2);
      return surf - Math.pow(Math.min(1, Math.abs(t)), 2.3) * tipRise;
    };

    // fins under the board
    g.fillStyle(0x2f6b78, 1);
    g.fillTriangle(cx - 36, surf + thick, cx - 22, surf + thick, cx - 29, surf + thick + 12);
    g.fillTriangle(cx + 22, surf + thick, cx + 36, surf + thick, cx + 29, surf + thick + 12);

    // board body (continuous rocker, upturned both ends)
    g.fillStyle(COLORS.board, 1);
    g.beginPath();
    g.moveTo(x0, topAt(x0));
    for (let x = x0; x <= x1; x += 6) g.lineTo(x, topAt(x));
    g.lineTo(x1, topAt(x1));
    for (let x = x1; x >= x0; x -= 6) g.lineTo(x, topAt(x) + thick);
    g.closePath();
    g.fillPath();
    // graphic stripe + edge highlight
    g.fillStyle(0xffcf2e, 1);
    g.fillRect(x0 + 14, surf + 1, x1 - x0 - 28, 3);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(x0 + 20, surf - 1, x1 - x0 - 40, 2);

    // boots / bindings (feet locked here). Front boot = accent, back = darker.
    const boot = (bx, topCol) => {
      g.fillStyle(0xeef2f4, 1);
      g.fillRoundedRect(bx - 12, surf - 19, 24, 23, 6);
      g.fillStyle(topCol, 1);
      g.fillRoundedRect(bx - 12, surf - 19, 24, 6, 3); // cuff (tells front from back)
      g.fillStyle(0x223a4c, 1);
      g.fillRoundedRect(bx - 12, surf - 6, 24, 5, 2); // strap
    };
    boot(backX, 0x6d7c86); // back foot — grey cuff
    boot(frontX, COLORS.accent); // front foot — accent cuff

    g.generateTexture("board", W, H);
    g.destroy();

    this.registry.set("boardGeom", {
      topLocalY: surf - H / 2, // top surface relative to texture center
      backFootX: backX - cx,
      frontFootX: frontX - cx,
      bootTopY: -19, // boot top relative to the board surface (legs end here)
    });
  }

  // Kicker ramp that sits on the water and launches the rider.
  makeKicker() {
    // A clean triangular kicker floating on the water: flat ride-up face
    // (the hypotenuse) rising from the water on the left to the lip on the
    // top-right. The rider glides up this face and launches off the lip.
    const w = 240; // keep in sync with config.KICKER_WIDTH
    const rise = 122; // keep in sync with config.KICKER_RISE
    const h = rise + 12;
    const g = this.g();

    // ramp body (triangle A=bottom-left, B=top-right lip, C=bottom-right)
    g.fillStyle(COLORS.kicker, 1);
    g.beginPath();
    g.moveTo(0, h); // A — water, left
    g.lineTo(w, h - rise); // B — lip, top right
    g.lineTo(w, h); // C — water, right
    g.closePath();
    g.fillPath();

    // shaded under-strip for a bit of depth
    g.fillStyle(0x0d3f4f, 1);
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(w, h - rise);
    g.lineTo(w, h - rise + 10);
    g.lineTo(8, h);
    g.closePath();
    g.fillPath();

    // bright lip / coping at the top of the ramp
    g.fillStyle(COLORS.kickerTop, 1);
    g.fillRoundedRect(w - 30, h - rise - 6, 30, 14, 4);

    // surface grip lines along the ride face
    g.lineStyle(3, 0x0a3a48, 0.5);
    for (let i = 1; i < 7; i++) {
      const x = (i / 7) * w;
      const yTop = h - rise * (x / w);
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x, yTop);
      g.strokePath();
    }

    g.generateTexture("kicker", w, h);
    g.destroy();
  }

  // A slider/box that floats on the water — grindable.
  makeRail() {
    const w = 260;
    const h = 70;
    const g = this.g();
    // legs / floats
    g.fillStyle(COLORS.railLeg, 1);
    g.fillRoundedRect(18, 24, 14, h - 24, 3);
    g.fillRoundedRect(w - 32, 24, 14, h - 24, 3);
    // top box
    g.fillStyle(COLORS.rail, 1);
    g.fillRoundedRect(0, 8, w, 22, 6);
    g.fillStyle(0xffffff, 0.4);
    g.fillRoundedRect(6, 11, w - 12, 5, 3);
    g.generateTexture("rail", w, h);
    g.destroy();
  }

  makeParticles() {
    const g = this.g();
    g.fillStyle(COLORS.foam, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture("spray", 16, 16);
    g.destroy();

    const s = this.g();
    s.fillStyle(0xffffff, 1);
    s.fillRect(0, 0, 6, 6);
    s.generateTexture("spark", 6, 6);
    s.destroy();
  }

  makeSky() {
    const w = 16;
    const h = 720;
    const g = this.g();
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(COLORS.skyTop),
        Phaser.Display.Color.ValueToColor(COLORS.skyBottom),
        h,
        y
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, y, w, 1);
    }
    g.generateTexture("sky", w, h);
    g.destroy();
  }

  makeHills() {
    const drawHills = (key, color, amp, baseY, step) => {
      const w = VIRTUAL_WIDTH;
      const h = 300;
      const g = this.g();
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(0, baseY);
      for (let x = 0; x <= w; x += step) {
        const y = baseY - Math.sin(x * 0.012) * amp - Math.sin(x * 0.031) * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fillPath();
      g.generateTexture(key, w, h);
      g.destroy();
    };
    drawHills("hillsFar", COLORS.hillsFar, 38, 150, 16);
    drawHills("hills", COLORS.hills, 64, 210, 12);
  }

  makeCloud() {
    const g = this.g();
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(30, 30, 22);
    g.fillCircle(58, 32, 26);
    g.fillCircle(88, 30, 20);
    g.fillRoundedRect(20, 30, 78, 22, 11);
    g.generateTexture("cloud", 120, 60);
    g.destroy();
  }

}
