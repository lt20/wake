import { describe, it, expect } from "vitest";
import * as C from "./config.js";
import {
  landingError,
  isCleanLanding,
  countRotations,
  scoreLanding,
  buildTrickName,
} from "./physics.js";

describe("landingError", () => {
  it("is zero when perfectly upright", () => {
    expect(landingError(0, 0)).toEqual({ flipErr: 0, spinErr: 0 });
  });

  it("is ~zero on clean rotation multiples (360 flip, 540 spin)", () => {
    const { flipErr, spinErr } = landingError(360, 540);
    expect(flipErr).toBe(0);
    expect(spinErr).toBe(0);
  });

  it("is maximal when upside-down / sideways", () => {
    expect(landingError(180, 90).flipErr).toBe(180);
    expect(landingError(180, 90).spinErr).toBe(90);
  });

  it("measures small offsets from upright", () => {
    expect(landingError(20, -30)).toEqual({ flipErr: 20, spinErr: 30 });
  });
});

describe("isCleanLanding", () => {
  it("is true inside both tolerances", () => {
    expect(isCleanLanding(20, 20, 42, 48)).toBe(true);
  });

  it("is false when flip exceeds tolerance", () => {
    expect(isCleanLanding(60, 10, 42, 48)).toBe(false);
  });

  it("is false when spin exceeds tolerance", () => {
    expect(isCleanLanding(10, 90, 42, 48)).toBe(false);
  });
});

describe("countRotations", () => {
  it("counts multiple flips and spins", () => {
    expect(countRotations(720, 540)).toEqual({ flips: 2, spins: 3 });
  });

  it("is zero for no rotation, sign-agnostic", () => {
    expect(countRotations(0, 0)).toEqual({ flips: 0, spins: 0 });
    expect(countRotations(-360, -180)).toEqual({ flips: 1, spins: 1 });
  });
});

describe("scoreLanding", () => {
  it("sums rotation + landing bonus, scaled by the multiplier", () => {
    const expected = Math.round(
      (100 + 1 * C.PTS_PER_FLIP + 2 * C.PTS_PER_SPIN + C.PTS_PERFECT_LAND) * 3
    );
    expect(
      scoreLanding({ flips: 1, spins: 2, pending: 100, multiplier: 3 })
    ).toBe(expected);
  });

  it("awards just the landing bonus on a plain pop (multiplier 1)", () => {
    expect(
      scoreLanding({ flips: 0, spins: 0, pending: 0, multiplier: 1 })
    ).toBe(C.PTS_PERFECT_LAND);
  });
});

describe("buildTrickName", () => {
  it("returns null when nothing notable happened", () => {
    expect(buildTrickName({ flipDeg: 0, spinDeg: 0, extras: [] })).toBe(null);
  });

  it("names a single flip by direction", () => {
    expect(buildTrickName({ flipDeg: 360, spinDeg: 0 })).toBe("Frontroll");
    expect(buildTrickName({ flipDeg: -360, spinDeg: 0 })).toBe("Backroll");
  });

  it("combines flip and spin", () => {
    expect(buildTrickName({ flipDeg: 360, spinDeg: 360 })).toBe(
      "Frontroll + FS 360"
    );
  });

  it("appends extras at the end (negative spin = backside)", () => {
    expect(
      buildTrickName({ flipDeg: 0, spinDeg: -180, extras: ["Grind"] })
    ).toBe("BS 180 + Grind");
  });
});
