import { describe, it, expect } from "vitest";
import * as C from "./config.js";
import {
  landingError,
  isCleanLanding,
  wipesOutOnWaterLanding,
  surfaceSpinPoints,
  countRotations,
  scoreLanding,
  buildTrickName,
  grabName,
  airInputFromDrag,
  airStep,
  edgeLoadAfter,
  popVelocityFromLoad,
  edgeName,
  handlePassState,
  signatureBonus,
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

describe("wipesOutOnWaterLanding", () => {
  it("always wipes out when still grabbing, even if perfectly upright", () => {
    expect(wipesOutOnWaterLanding(true, 0, 0, 42, 48)).toBe(true);
  });

  it("wipes out when rotation is out of tolerance", () => {
    expect(wipesOutOnWaterLanding(false, 90, 0, 42, 48)).toBe(true);
    expect(wipesOutOnWaterLanding(false, 0, 90, 42, 48)).toBe(true);
  });

  it("does NOT wipe out on a clean, grab-free landing", () => {
    expect(wipesOutOnWaterLanding(false, 20, 20, 42, 48)).toBe(false);
  });

  it("wipes out when splashing down still extended in a Raley", () => {
    expect(wipesOutOnWaterLanding(false, 0, 0, 42, 48, true)).toBe(true);
  });

  it("lands clean once the Raley has swung back under the rider", () => {
    expect(wipesOutOnWaterLanding(false, 0, 0, 42, 48, false)).toBe(false);
  });
});

describe("surfaceSpinPoints", () => {
  it("awards nothing below a completed 180", () => {
    expect(surfaceSpinPoints(0)).toBe(0);
    expect(surfaceSpinPoints(179)).toBe(0);
  });

  it("awards one increment per completed 180, sign-agnostic", () => {
    expect(surfaceSpinPoints(180)).toBe(C.PTS_SURFACE_SPIN_PER_180);
    expect(surfaceSpinPoints(360)).toBe(2 * C.PTS_SURFACE_SPIN_PER_180);
    expect(surfaceSpinPoints(-540)).toBe(3 * C.PTS_SURFACE_SPIN_PER_180);
  });

  // The rule: a grounded spin has no wipeout path — only an air→water landing
  // does, and that is the sole caller of wipesOutOnWaterLanding.
  it("scores a surface spin without any wipeout decision", () => {
    expect(surfaceSpinPoints(360)).toBeGreaterThan(0);
  });
});

describe("grabName", () => {
  it("defaults to Indy when the hold is neutral", () => {
    expect(grabName(0, 0)).toBe("Indy");
  });

  it("maps a down hold to Indy", () => {
    expect(grabName(0, 8)).toBe("Indy");
  });

  it("maps forward/back holds to Nose/Tail", () => {
    expect(grabName(10, 0)).toBe("Nose");
    expect(grabName(-10, 0)).toBe("Tail");
  });

  it("maps up holds to Method / Stalefish / Mute", () => {
    expect(grabName(0, -10)).toBe("Method");
    expect(grabName(-6, -10)).toBe("Stalefish");
    expect(grabName(6, -10)).toBe("Mute");
  });
});

describe("airInputFromDrag", () => {
  it("is neutral below the threshold on both axes", () => {
    expect(airInputFromDrag(5, -5, 26, 480)).toEqual({
      spinVel: 0,
      flipVel: 0,
      rotating: false,
    });
  });

  it("maps a horizontal drag to a spin (sign-preserving)", () => {
    expect(airInputFromDrag(40, 0, 26, 480)).toEqual({
      spinVel: 480,
      flipVel: 0,
      rotating: true,
    });
    expect(airInputFromDrag(-40, 0, 26, 480).spinVel).toBe(-480);
  });

  it("maps a vertical drag to a flip (sign-preserving)", () => {
    expect(airInputFromDrag(0, 50, 26, 480).flipVel).toBe(480);
    expect(airInputFromDrag(0, -50, 26, 480).flipVel).toBe(-480);
  });

  it("rotates on BOTH axes for a diagonal drag (like holding two arrows)", () => {
    expect(airInputFromDrag(40, -40, 26, 480)).toEqual({
      spinVel: 480,
      flipVel: -480,
      rotating: true,
    });
  });
});

describe("airStep", () => {
  it("accelerates downward under gravity", () => {
    const { y, vy } = airStep(100, 0, 0.5, { gravity: 1720, maxFall: 1500 });
    expect(vy).toBeCloseTo(860);
    expect(y).toBeCloseTo(100 + 860 * 0.5);
  });

  it("clamps the fall speed to the terminal value", () => {
    const { vy } = airStep(0, 1490, 0.1, { gravity: 1720, maxFall: 1500 });
    expect(vy).toBe(1500);
  });

  it("a gentler gravity floats longer than free fall for the same launch", () => {
    const float = airStep(0, -720, 0.1, { gravity: 1720, maxFall: 1500 }).vy;
    const heavy = airStep(0, -720, 0.1, { gravity: 2400, maxFall: 1500 }).vy;
    expect(float).toBeLessThan(heavy); // still rising faster (less decelerated)
  });
});

describe("edgeLoadAfter", () => {
  it("builds toward 1 while edging and clamps there", () => {
    expect(edgeLoadAfter(0, 0.55, true, 1.1, 1.8)).toBeCloseTo(0.5);
    expect(edgeLoadAfter(0.9, 1.0, true, 1.1, 1.8)).toBe(1);
  });

  it("decays toward 0 once released and clamps there", () => {
    expect(edgeLoadAfter(1, 0.9, false, 1.1, 1.8)).toBeCloseTo(0.5);
    expect(edgeLoadAfter(0.1, 1.0, false, 1.1, 1.8)).toBe(0);
  });
});

describe("popVelocityFromLoad", () => {
  it("interpolates min→max by load", () => {
    expect(popVelocityFromLoad(0, 530, 1050, false, 320)).toBe(530);
    expect(popVelocityFromLoad(1, 530, 1050, false, 320)).toBe(1050);
    expect(popVelocityFromLoad(0.5, 530, 1050, false, 320)).toBe(790);
  });

  it("adds the perfect bonus and clamps out-of-range load", () => {
    expect(popVelocityFromLoad(1, 530, 1050, true, 320)).toBe(1370);
    expect(popVelocityFromLoad(2, 530, 1050, false, 320)).toBe(1050);
  });
});

describe("edgeName", () => {
  it("names heelside / toeside by direction", () => {
    expect(edgeName(-1)).toBe("Heelside");
    expect(edgeName(1)).toBe("Toeside");
    expect(edgeName(0)).toBe(null);
  });

  it("swaps sides in switch stance", () => {
    expect(edgeName(-1, 1)).toBe("Toeside");
    expect(edgeName(1, 1)).toBe("Heelside");
  });
});

describe("handlePassState", () => {
  it("holds the handle in front, lead hand, when facing forward", () => {
    expect(handlePassState(0)).toEqual({ behind: false, hand: 0, passProgress: 0 });
  });

  it("keeps the bar in FRONT through a frontside 180 (chest sweeps past the tow)", () => {
    expect(handlePassState(60).behind).toBe(false);
    expect(handlePassState(120).behind).toBe(false);
    expect(handlePassState(180).behind).toBe(false);
  });

  it("routes the bar BEHIND the back through a backside 180, deepest at -90", () => {
    expect(handlePassState(-60).behind).toBe(true);
    expect(handlePassState(-120).behind).toBe(true);
    expect(handlePassState(-90)).toEqual({ behind: true, hand: 1, passProgress: 1 });
    expect(handlePassState(-45).passProgress).toBeCloseTo(Math.SQRT1_2, 5);
    expect(handlePassState(-180).behind).toBe(false); // landed blind: bar back in front
  });

  it("swaps hands each half turn", () => {
    expect(handlePassState(120).hand).toBe(0);
    expect(handlePassState(240).hand).toBe(1);
  });

  it("wraps across turns: a frontside 360 still passes the bar on its BACK half", () => {
    expect(handlePassState(270).behind).toBe(true); // FS 360, three-quarters in
    expect(handlePassState(360).behind).toBe(false); // full turn back to front
    expect(handlePassState(540).behind).toBe(false); // 540 → 180: chest-side arc
    expect(handlePassState(630).behind).toBe(true); // 630 → 270
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

  it("names a Raley (board out behind), overriding the flip", () => {
    expect(buildTrickName({ flipDeg: 0, spinDeg: 0, raley: true })).toBe("Raley");
    expect(buildTrickName({ flipDeg: 0, spinDeg: 180, raley: true })).toBe("Raley + FS 180");
  });

  it("names an edged backroll a Tantrum", () => {
    expect(buildTrickName({ flipDeg: -360, spinDeg: 0, edged: true })).toBe("Tantrum");
    // a frontroll off the edge is NOT a tantrum
    expect(buildTrickName({ flipDeg: 360, spinDeg: 0, edged: true })).toBe("Frontroll");
  });

  it("prefixes Switch and suffixes to blind", () => {
    expect(
      buildTrickName({ flipDeg: -360, spinDeg: 0, switchStance: true })
    ).toBe("Switch Backroll");
    expect(
      buildTrickName({ flipDeg: 0, spinDeg: 180, landsBlind: true })
    ).toBe("FS 180 to blind");
  });
});

describe("signatureBonus", () => {
  it("is zero for a plain trick", () => {
    expect(signatureBonus({})).toBe(0);
  });

  it("sums the flagged signature bonuses", () => {
    expect(signatureBonus({ raley: true })).toBe(C.PTS_RALEY);
    expect(signatureBonus({ tantrum: true, switchStance: true })).toBe(
      C.PTS_TANTRUM + C.PTS_SWITCH_TAKEOFF
    );
    expect(signatureBonus({ landsBlind: true })).toBe(C.PTS_BLIND_LAND);
  });
});
