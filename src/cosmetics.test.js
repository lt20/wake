import { describe, it, expect } from "vitest";
import { catalog, itemOf, costOf, isUnlocked, purchase } from "./cosmetics.js";
import { defaultProfile } from "./storage.js";

describe("catalog", () => {
  it("exposes riders/boards/spots with a free default each", () => {
    for (const kind of ["riders", "boards", "spots"]) {
      expect(catalog(kind).length).toBeGreaterThan(0);
      expect(catalog(kind).some((i) => i.cost === 0)).toBe(true);
    }
    expect(catalog("nope")).toEqual([]);
  });

  it("looks up items and costs", () => {
    expect(itemOf("riders", "default").name).toBe("Classic");
    expect(costOf("riders", "neon")).toBeGreaterThan(0);
    expect(costOf("riders", "ghost")).toBe(0); // unknown → 0
  });
});

describe("isUnlocked / purchase", () => {
  it("the default items ship unlocked", () => {
    const p = defaultProfile();
    expect(isUnlocked(p, "riders", "default")).toBe(true);
    expect(isUnlocked(p, "riders", "neon")).toBe(false);
  });

  it("buys an affordable item, spends coins, and does not mutate the input", () => {
    const p = defaultProfile();
    p.coins = 2000;
    const res = purchase(p, "riders", "neon");
    expect(res.ok).toBe(true);
    expect(res.profile.coins).toBe(2000 - costOf("riders", "neon"));
    expect(isUnlocked(res.profile, "riders", "neon")).toBe(true);
    expect(isUnlocked(p, "riders", "neon")).toBe(false); // original untouched
  });

  it("refuses when too poor or already owned", () => {
    const p = defaultProfile();
    p.coins = 10;
    expect(purchase(p, "riders", "neon").reason).toBe("poor");
    expect(purchase(p, "riders", "default").reason).toBe("owned");
    expect(purchase(p, "riders", "ghost").reason).toBe("unknown");
  });
});
