import { describe, it, expect } from "vitest";
import {
  coinsForRun,
  evaluateMissions,
  applyRun,
  dailyChallengeFor,
  MISSIONS,
} from "./progression.js";
import { defaultProfile } from "./storage.js";

describe("coinsForRun", () => {
  it("awards 1 coin per 100 points, floored, never negative", () => {
    expect(coinsForRun({ score: 2550 })).toBe(25);
    expect(coinsForRun({ score: 0 })).toBe(0);
    expect(coinsForRun({})).toBe(0);
  });
});

describe("evaluateMissions", () => {
  it("completes missions whose target is met and awards their reward", () => {
    const p = defaultProfile();
    const { missions, coinsAwarded, completed } = evaluateMissions(
      { score: 12000, bestCombo: 6, tricksLanded: 12, wipeouts: 1 },
      p
    );
    expect(completed.length).toBe(3); // land10, combo5, score10k (not clean: wiped)
    expect(missions.score10k.done).toBe(true);
    const expected =
      MISSIONS.find((m) => m.id === "land10").reward +
      MISSIONS.find((m) => m.id === "combo5").reward +
      MISSIONS.find((m) => m.id === "score10k").reward;
    expect(coinsAwarded).toBe(expected);
  });

  it("does not re-award an already-completed mission", () => {
    const p = defaultProfile();
    p.missions = { land10: { done: true } };
    const { coinsAwarded, completed } = evaluateMissions(
      { score: 0, bestCombo: 1, tricksLanded: 50, wipeouts: 0 },
      p
    );
    expect(completed).not.toContain(MISSIONS.find((m) => m.id === "land10").name);
    expect(coinsAwarded).toBe(0);
  });

  it("recognises a clean run (no wipeout, score ≥ 3000)", () => {
    const p = defaultProfile();
    const { completed } = evaluateMissions({ score: 3200, bestCombo: 2, tricksLanded: 3, wipeouts: 0 }, p);
    expect(completed).toContain(MISSIONS.find((m) => m.id === "clean").name);
  });
});

describe("applyRun", () => {
  it("banks run + mission coins and bumps stats without mutating input", () => {
    const p = defaultProfile();
    const summary = { score: 10500, bestCombo: 5, tricksLanded: 11, wipeouts: 0 };
    const res = applyRun(summary, p);
    expect(res.profile.coins).toBe(res.runCoins + res.missionCoins);
    expect(res.profile.stats.runs).toBe(1);
    expect(res.profile.stats.bestCombo).toBe(5);
    expect(p.coins).toBe(0); // original untouched
  });
});

describe("dailyChallengeFor", () => {
  it("is deterministic per date and differs across dates", () => {
    expect(dailyChallengeFor("2026-07-01").seed).toBe(dailyChallengeFor("2026-07-01").seed);
    expect(dailyChallengeFor("2026-07-01").seed).not.toBe(dailyChallengeFor("2026-07-02").seed);
  });
});
