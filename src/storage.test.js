import { describe, it, expect } from "vitest";
import {
  loadBest,
  saveBestIfHigher,
  loadMuted,
  saveMuted,
  defaultProfile,
  loadProfile,
  saveProfile,
} from "./storage.js";

// In-memory stand-in for the Web Storage API.
function mockStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

describe("loadBest", () => {
  it("returns 0 on an empty store", () => {
    expect(loadBest(mockStore())).toBe(0);
  });

  it("returns 0 when storage is unavailable", () => {
    expect(loadBest(null)).toBe(0);
  });

  it("returns 0 on a corrupt value", () => {
    expect(loadBest(mockStore({ "cable-rush:best": "not-a-number" }))).toBe(0);
  });

  it("reads a stored value", () => {
    expect(loadBest(mockStore({ "cable-rush:best": "1234" }))).toBe(1234);
  });
});

describe("saveBestIfHigher", () => {
  it("records a new best on an empty store and persists it", () => {
    const store = mockStore();
    expect(saveBestIfHigher(500, store)).toEqual({ best: 500, isNewBest: true });
    expect(loadBest(store)).toBe(500);
  });

  it("keeps the existing best when the score is lower", () => {
    const store = mockStore({ "cable-rush:best": "800" });
    expect(saveBestIfHigher(300, store)).toEqual({ best: 800, isNewBest: false });
    expect(loadBest(store)).toBe(800);
  });

  it("updates when the score beats the existing best", () => {
    const store = mockStore({ "cable-rush:best": "800" });
    expect(saveBestIfHigher(1200, store)).toEqual({ best: 1200, isNewBest: true });
    expect(loadBest(store)).toBe(1200);
  });

  it("does not throw and reports a new best when storage is unavailable", () => {
    expect(saveBestIfHigher(700, null)).toEqual({ best: 700, isNewBest: true });
  });
});

describe("mute preference", () => {
  it("defaults to false and round-trips through the store", () => {
    const store = mockStore();
    expect(loadMuted(store)).toBe(false);
    saveMuted(true, store);
    expect(loadMuted(store)).toBe(true);
    saveMuted(false, store);
    expect(loadMuted(store)).toBe(false);
  });

  it("is false and does not throw without storage", () => {
    expect(loadMuted(null)).toBe(false);
    expect(() => saveMuted(true, null)).not.toThrow();
  });
});

describe("player profile", () => {
  it("returns a fresh default profile on an empty store", () => {
    const p = loadProfile(mockStore());
    expect(p.version).toBe(1);
    expect(p.coins).toBe(0);
    expect(p.unlocked.riders).toContain("default");
    expect(p.equipped.spot).toBe("lake");
  });

  it("returns a default profile when storage is unavailable", () => {
    expect(loadProfile(null)).toEqual(defaultProfile());
  });

  it("round-trips a saved profile", () => {
    const store = mockStore();
    const p = defaultProfile();
    p.coins = 250;
    p.unlocked.boards.push("carbon");
    saveProfile(p, store);
    const back = loadProfile(store);
    expect(back.coins).toBe(250);
    expect(back.unlocked.boards).toContain("carbon");
  });

  it("normalizes a partial/older stored profile onto current defaults", () => {
    const store = mockStore({ "cable-rush:profile": JSON.stringify({ coins: 99 }) });
    const p = loadProfile(store);
    expect(p.coins).toBe(99);
    expect(p.unlocked.riders).toContain("default"); // filled in
    expect(p.stats.runs).toBe(0);
  });

  it("falls back to a default on a corrupt profile", () => {
    const store = mockStore({ "cable-rush:profile": "{not json" });
    expect(loadProfile(store)).toEqual(defaultProfile());
  });

  it("does not throw saving without storage", () => {
    expect(() => saveProfile(defaultProfile(), null)).not.toThrow();
  });
});
