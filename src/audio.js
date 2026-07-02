// ============================================================================
// Cable Rush — synthesized sound (Web Audio API, no audio files).
//
// The AudioContext is created LAZILY inside resume(), which is only ever called
// from a user-gesture handler — so nothing touches Web Audio before the first
// interaction (browser autoplay policy). play()/startHum() are safe no-ops
// until then, and whenever muted. Mute state persists via storage.js.
//
// SOUNDS / soundSpec are pure data so the selection + mute logic is unit-tested
// without a real AudioContext.
// ============================================================================
import { loadMuted, saveMuted } from "./storage.js";

// Each sound is one or more oscillator "voices" (optionally pitch-swept) plus an
// optional filtered noise burst. Gains are small; the master gain handles mute.
export const SOUNDS = {
  pop: { voices: [{ type: "square", f0: 220, f1: 460, dur: 0.12, gain: 0.18 }] },
  perfectPop: {
    voices: [
      { type: "square", f0: 330, f1: 680, dur: 0.16, gain: 0.16 },
      { type: "triangle", f0: 660, f1: 990, dur: 0.18, gain: 0.12, delay: 0.02 },
    ],
  },
  land: {
    voices: [{ type: "sine", f0: 200, f1: 120, dur: 0.16, gain: 0.22 }],
    noise: { dur: 0.1, gain: 0.08, filter: { type: "lowpass", freq: 900 } },
  },
  wipeout: {
    voices: [{ type: "sawtooth", f0: 300, f1: 70, dur: 0.4, gain: 0.2 }],
    noise: { dur: 0.4, gain: 0.16, filter: { type: "lowpass", freq: 1400 } },
  },
  comboUp: {
    voices: [{ type: "triangle", f0: 440, f1: 880, dur: 0.16, gain: 0.16 }],
  },
  grind: {
    noise: { dur: 0.26, gain: 0.12, filter: { type: "bandpass", freq: 1200 } },
  },
  surfaceSpin: {
    voices: [{ type: "sine", f0: 520, f1: 720, dur: 0.16, gain: 0.12 }],
    noise: { dur: 0.16, gain: 0.06, filter: { type: "bandpass", freq: 1800 } },
  },
  carve: {
    // spray hiss of an edge digging in — a short rising bandpass whoosh
    noise: { dur: 0.3, gain: 0.1, filter: { type: "bandpass", freq: 1400 } },
  },
};

export function soundSpec(name) {
  return SOUNDS[name] || null;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null; // separate gain so music can duck under SFX
    this.hum = null;
    this._noise = null;
    this.samples = {}; // name → decoded AudioBuffer (optional real SFX/music)
    this.music = null; // { src, name } currently playing loop
    this.muted = loadMuted();
  }

  // Lazily build the context — called ONLY from user-gesture handlers.
  _ensure() {
    if (this.ctx) return this.ctx;
    const AC =
      typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.6; // music sits under the SFX
    this.musicBus.connect(this.master);
    return this.ctx;
  }

  // Decode + register a real audio sample under `name`. Once present, play(name)
  // prefers it over the synth voice. Safe no-op until the context exists.
  async loadSample(name, arrayBuffer) {
    const ctx = this._ensure();
    if (!ctx || !arrayBuffer) return;
    try {
      this.samples[name] = await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      // undecodable — leave the synth fallback in place
    }
  }

  // Fetch + decode the sample files declared in a manifest ({ name: [urls] }).
  // Only real, reachable files register; everything else keeps the synth.
  async loadSamplesFrom(manifest) {
    if (!manifest) return;
    await Promise.all(
      Object.entries(manifest).map(async ([name, urls]) => {
        for (const url of urls) {
          try {
            const buf = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null));
            if (buf) {
              await this.loadSample(name, buf);
              return;
            }
          } catch (e) {
            /* try the next format */
          }
        }
      })
    );
  }

  // Play a one-shot sample buffer through a destination bus.
  _playBuffer(buffer, dest, { loop = false, gain = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(dest);
    src.start(ctx.currentTime);
    return src;
  }

  // Start/replace the looping music track (by sample name). No-op if the track
  // isn't loaded, so the game is silent-but-fine until real music is dropped in.
  playMusic(name) {
    if (this.muted || !this.ctx) return;
    if (this.music && this.music.name === name) return; // already playing
    this.stopMusic();
    const buf = this.samples[name];
    if (!buf) return; // no music asset — stay quiet (the cable hum still plays)
    const src = this._playBuffer(buf, this.musicBus, { loop: true });
    this.music = { src, name };
  }

  stopMusic() {
    if (!this.music) return;
    try {
      this.music.src.stop();
    } catch (e) {
      /* already stopped */
    }
    this.music = null;
  }

  // Call on the first user gesture to create + unlock the context.
  resume() {
    const ctx = this._ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(m) {
    this.muted = m;
    saveMuted(m);
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (m) this.stopHum();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  play(name) {
    if (this.muted || !this.ctx) return;
    // Prefer a real sample if one was loaded; otherwise synthesize the voice.
    if (this.samples[name]) {
      this._playBuffer(this.samples[name], this.master);
      return;
    }
    const spec = soundSpec(name);
    if (!spec) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (spec.voices) {
      for (const v of spec.voices) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + (v.delay || 0);
        osc.type = v.type || "sine";
        osc.frequency.setValueAtTime(v.f0, start);
        if (v.f1 != null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.f1), start + v.dur);
        }
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(v.gain ?? 0.2, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);
        osc.connect(g).connect(this.master);
        osc.start(start);
        osc.stop(start + v.dur + 0.02);
      }
    }

    if (spec.noise) {
      const n = spec.noise;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer();
      const g = ctx.createGain();
      g.gain.setValueAtTime(n.gain ?? 0.15, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.dur);
      if (n.filter) {
        const f = ctx.createBiquadFilter();
        f.type = n.filter.type || "lowpass";
        f.frequency.value = n.filter.freq || 1000;
        src.connect(f);
        f.connect(g);
      } else {
        src.connect(g);
      }
      g.connect(this.master);
      src.start(now);
      src.stop(now + n.dur + 0.02);
    }
  }

  // Low looping hum: the cable tow drone while riding.
  startHum() {
    if (this.muted || !this.ctx || this.hum) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 70;
    g.gain.value = 0.04;
    osc.connect(g).connect(this.master);
    osc.start();
    this.hum = { osc, g };
  }

  stopHum() {
    if (!this.hum) return;
    try {
      this.hum.osc.stop();
    } catch (e) {
      // already stopped
    }
    this.hum = null;
  }
}

// Shared singleton used across scenes.
export const audio = new AudioEngine();
