import { describe, it, expect } from "vitest";
import { SOUNDS, soundSpec, AudioEngine } from "./audio.js";

const NAMES = ["pop", "perfectPop", "land", "wipeout", "comboUp", "grind", "surfaceSpin"];

describe("SOUNDS catalogue", () => {
  it("defines every required sound", () => {
    for (const n of NAMES) expect(soundSpec(n), n).toBeTruthy();
  });

  it("returns null for an unknown sound", () => {
    expect(soundSpec("nope")).toBe(null);
  });

  it("each spec has voices and/or a noise burst", () => {
    for (const n of NAMES) {
      const s = SOUNDS[n];
      expect(Array.isArray(s.voices) || !!s.noise, n).toBe(true);
    }
  });
});

describe("AudioEngine mute", () => {
  it("defaults unmuted and toggles", () => {
    const a = new AudioEngine();
    expect(a.isMuted()).toBe(false);
    expect(a.toggleMute()).toBe(true);
    expect(a.isMuted()).toBe(true);
    expect(a.toggleMute()).toBe(false);
  });
});

describe("AudioEngine without Web Audio (node)", () => {
  it("resume() creates no context and does not throw", () => {
    const a = new AudioEngine();
    expect(() => a.resume()).not.toThrow();
    expect(a.ctx).toBe(null);
  });

  it("play() / startHum() are safe no-ops", () => {
    const a = new AudioEngine();
    expect(() => a.play("pop")).not.toThrow();
    expect(() => a.play("unknown")).not.toThrow();
    a.setMuted(true);
    expect(() => a.play("land")).not.toThrow();
    expect(() => a.startHum()).not.toThrow();
    expect(a.hum).toBe(null);
  });
});
