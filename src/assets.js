// ============================================================================
// Cable Rush — asset manifest (the "fallback procedural" contract).
//
// The game ships with ZERO binary assets: BootScene generates every texture and
// sound procedurally. This manifest declares the OPTIONAL real assets that can
// be dropped into `public/assets/` later. At boot, BootScene tries to load them
// and, for any key that did NOT load, falls back to the procedural generator —
// so the game looks/sounds identical with no assets, and "levels up" the moment
// real art or audio is present. Migration is key-by-key, zero code churn.
//
// To use real art: drop the files under `public/assets/…` at the paths below,
// then flip ASSETS_ENABLED to true (or leave it — missing files just fall back).
// ============================================================================

// Master switch. Left false because the repo currently has no asset files; the
// loader still probes gracefully, but skipping the load entirely avoids a burst
// of 404s during development. Flip to true once assets exist under public/assets.
export const ASSETS_ENABLED = false;

// Texture keys the rest of the code references (BootScene generates any that a
// real asset does not replace). Grouped for readability.
export const TEXTURE_KEYS = {
  rider: ["body", "board"],
  world: [
    "kicker",
    "kickerBig",
    "rail",
    "railLong",
    "railDown",
    "railKink",
    "flatbox",
    "aframeBack",
  ],
  backdrop: ["sky", "mountains", "hills", "hillsFar", "cloud"],
  fx: ["spray", "spark"],
};

// Optional image atlas (texture-packed). Path is relative to the site root
// (files served verbatim from `public/`). Absent files fall back to procedural.
export const IMAGE_ATLAS = {
  key: "game",
  texture: "assets/atlas/game.png",
  atlas: "assets/atlas/game.json",
};

// Optional rider animation frames, played by GameScene.applyRiderSkin(state)
// when a rider atlas is present. Frame names are looked up in the atlas.
export const RIDER_ANIMS = {
  ride: { prefix: "rider_ride_", end: 3, frameRate: 8, repeat: -1 },
  air: { prefix: "rider_air_", end: 1, frameRate: 6, repeat: -1 },
  grab: { prefix: "rider_grab_", end: 1, frameRate: 6, repeat: -1 },
  grind: { prefix: "rider_grind_", end: 1, frameRate: 8, repeat: -1 },
  wipeout: { prefix: "rider_wipeout_", end: 2, frameRate: 10, repeat: 0 },
};

// Optional audio samples (ogg + mp3 for cross-browser). Keys mirror audio.js
// SOUNDS so play() prefers a sample and falls back to the synth voice.
export const AUDIO_SAMPLES = {
  music_menu: ["assets/audio/music_menu.ogg", "assets/audio/music_menu.mp3"],
  music_run: ["assets/audio/music_run.ogg", "assets/audio/music_run.mp3"],
  pop: ["assets/audio/pop.ogg", "assets/audio/pop.mp3"],
  land: ["assets/audio/land.ogg", "assets/audio/land.mp3"],
  wipeout: ["assets/audio/wipeout.ogg", "assets/audio/wipeout.mp3"],
};
