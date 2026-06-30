import { describe, it, expect } from "vitest";
import * as C from "./config.js";
import {
  MODULES,
  moduleFootprint,
  getModule,
  isValidModule,
  nextSegment,
  pickModule,
} from "./modules.js";

const EXPECTED_TYPES = [
  "kicker",
  "kickerBig",
  "rail",
  "bigSlide",
  "slideToKicker",
  "kickerToSlide",
  "aFrame",
  "doubleKicker",
  "downSlide",
  "kinkRail",
  "flatBox",
];

describe("MODULES catalogue", () => {
  it("has at least 10 distinct module types", () => {
    const types = new Set(MODULES.map((m) => m.type));
    expect(types.size).toBeGreaterThanOrEqual(10);
    expect(types.size).toBe(MODULES.length); // all distinct
  });

  it("contains every expected type, including composites", () => {
    for (const t of EXPECTED_TYPES) expect(getModule(t), t).toBeTruthy();
  });

  it("every entry is structurally valid", () => {
    for (const m of MODULES) expect(isValidModule(m), m.type).toBe(true);
  });

  it("rejects malformed defs", () => {
    expect(isValidModule(null)).toBe(false);
    expect(isValidModule({ type: "x" })).toBe(false);
    expect(isValidModule({ ...getModule("kicker"), segments: [] })).toBe(false);
    expect(isValidModule({ ...getModule("kicker"), weight: 0 })).toBe(false);
  });
});

describe("moduleFootprint", () => {
  it("matches the original single-segment widths", () => {
    expect(moduleFootprint(getModule("kicker"))).toBe(C.KICKER_WIDTH);
    expect(moduleFootprint(getModule("rail"))).toBe(260);
  });

  it("spans to the rightmost segment for composites", () => {
    expect(moduleFootprint(getModule("slideToKicker"))).toBe(260 + C.KICKER_WIDTH); // 500
    expect(moduleFootprint(getModule("kickerToSlide"))).toBe(280 + 360); // 640
    expect(moduleFootprint(getModule("doubleKicker"))).toBe(360 + C.KICKER_WIDTH); // 600
  });
});

describe("nextSegment", () => {
  it("transitions grind→ride-up across a slide→kicker", () => {
    const def = getModule("slideToKicker");
    expect(nextSegment(def, 0.1).kind).toBe("grind");
    expect(nextSegment(def, 0.95).kind).toBe("ride-up");
  });

  it("transitions ride-up→grind across a kicker→slide", () => {
    const def = getModule("kickerToSlide");
    expect(nextSegment(def, 0.05).kind).toBe("ride-up");
    expect(nextSegment(def, 0.9).kind).toBe("grind");
  });

  it("returns null in the gap between double kickers", () => {
    const def = getModule("doubleKicker"); // footprint 600, gap 240..360
    expect(nextSegment(def, 0.1).kind).toBe("ride-up"); // x=60, first kicker
    expect(nextSegment(def, 0.5)).toBe(null); // x=300, gap
    expect(nextSegment(def, 0.95).kind).toBe("ride-up"); // x=570, second kicker
  });
});

describe("pickModule", () => {
  it("returns the first module at the bottom of the range", () => {
    expect(pickModule(() => 0)).toBe(MODULES[0]);
  });

  it("returns the last module at the top of the range", () => {
    expect(pickModule(() => 0.999)).toBe(MODULES[MODULES.length - 1]);
  });

  it("respects relative weights (heavy types beat weight-1 composites)", () => {
    const N = 5000;
    const counts = {};
    for (let i = 0; i < N; i++) {
      const t = pickModule(() => (i + 0.5) / N).type;
      counts[t] = (counts[t] || 0) + 1;
    }
    // kicker (weight 3) is picked clearly more often than a composite (weight 1)
    expect(counts.kicker).toBeGreaterThan(counts.slideToKicker);
    // a uniform sweep covers the whole catalogue
    expect(Object.keys(counts).length).toBe(MODULES.length);
  });
});
