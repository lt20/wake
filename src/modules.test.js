import { describe, it, expect } from "vitest";
import * as C from "./config.js";
import {
  MODULES,
  moduleFootprint,
  getModule,
  isValidModule,
  pickModule,
} from "./modules.js";

describe("MODULES catalogue", () => {
  it("every entry is structurally valid", () => {
    for (const m of MODULES) expect(isValidModule(m)).toBe(true);
  });

  it("re-expresses the original kicker and rail", () => {
    expect(getModule("kicker")).toBeTruthy();
    expect(getModule("rail")).toBeTruthy();
  });

  it("rejects malformed defs", () => {
    expect(isValidModule(null)).toBe(false);
    expect(isValidModule({ type: "x" })).toBe(false);
    expect(isValidModule({ ...getModule("kicker"), segments: [] })).toBe(false);
    expect(isValidModule({ ...getModule("kicker"), weight: 0 })).toBe(false);
  });
});

describe("moduleFootprint", () => {
  it("matches the original texture widths", () => {
    expect(moduleFootprint(getModule("kicker"))).toBe(C.KICKER_WIDTH);
    expect(moduleFootprint(getModule("rail"))).toBe(260);
  });
});

describe("pickModule", () => {
  it("selects by weight bucket", () => {
    expect(pickModule(() => 0).type).toBe("kicker"); // low bucket = kicker
    expect(pickModule(() => 0.99).type).toBe("rail"); // top bucket = rail
  });

  it("respects the 2:1 kicker:rail weighting over a uniform sweep", () => {
    const N = 3000;
    let kicker = 0;
    for (let i = 0; i < N; i++) {
      if (pickModule(() => (i + 0.5) / N).type === "kicker") kicker++;
    }
    const frac = kicker / N;
    expect(frac).toBeGreaterThan(0.6);
    expect(frac).toBeLessThan(0.72);
  });
});
