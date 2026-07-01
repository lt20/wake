import { describe, it, expect } from "vitest";
import * as C from "./config.js";
import { difficultyForElapsed } from "./difficulty.js";

describe("difficultyForElapsed — speed", () => {
  it("starts at BASE_SPEED and never exceeds MAX_SPEED", () => {
    expect(difficultyForElapsed(0).speedTarget).toBe(C.BASE_SPEED);
    for (const t of [0, 10, 30, 60, 90, 1000]) {
      const s = difficultyForElapsed(t).speedTarget;
      expect(s).toBeGreaterThanOrEqual(C.BASE_SPEED);
      expect(s).toBeLessThanOrEqual(C.MAX_SPEED);
    }
  });

  it("is monotonically non-decreasing", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 120; t += 5) {
      const s = difficultyForElapsed(t).speedTarget;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("difficultyForElapsed — gaps", () => {
  it("keeps gapMin at the floor and gapMin ≤ gapMax ≤ SPAWN_GAP_MAX", () => {
    for (const t of [0, 30, 60, 90, 1000]) {
      const d = difficultyForElapsed(t);
      expect(d.gapMin).toBeGreaterThanOrEqual(C.SPAWN_GAP_MIN);
      expect(d.gapMax).toBeGreaterThanOrEqual(d.gapMin);
      expect(d.gapMax).toBeLessThanOrEqual(C.SPAWN_GAP_MAX);
    }
  });

  it("tightens over time (gapMax non-increasing)", () => {
    let prev = Infinity;
    for (let t = 0; t <= 120; t += 10) {
      const g = difficultyForElapsed(t).gapMax;
      expect(g).toBeLessThanOrEqual(prev);
      prev = g;
    }
  });
});

describe("difficultyForElapsed — module mix", () => {
  it("yields a positive total of non-negative weights for every type", () => {
    const w = difficultyForElapsed(45).moduleWeights;
    const vals = Object.values(w);
    expect(vals.length).toBeGreaterThanOrEqual(10);
    expect(vals.every((v) => v >= 0)).toBe(true);
    expect(vals.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("hardens: composites get heavier late in the run", () => {
    const early = difficultyForElapsed(0).moduleWeights;
    const late = difficultyForElapsed(C.RUN_DURATION).moduleWeights;
    expect(late.slideToKicker).toBeGreaterThan(early.slideToKicker);
    expect(late.kickerToSlide).toBeGreaterThan(early.kickerToSlide);
    expect(late.doubleKicker).toBeGreaterThan(early.doubleKicker);
  });
});
