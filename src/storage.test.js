import { describe, it, expect } from "vitest";
import { loadBest, saveBestIfHigher, loadMuted, saveMuted } from "./storage.js";

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
