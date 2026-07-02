// ============================================================================
// Cable Rush — persistent best score (localStorage), with graceful fallback
// when storage is unavailable (private mode, disabled, server/test env).
// The `store` param is injectable so the logic is unit-testable without a DOM.
// ============================================================================
const KEY = "cable-rush:best";
const MUTE_KEY = "cable-rush:muted";
const PROFILE_KEY = "cable-rush:profile";
const PROFILE_VERSION = 1;

function defaultStore() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (e) {
    // accessing localStorage can throw (e.g. sandboxed iframe)
  }
  return null;
}

// Current best, or 0 when nothing is stored / storage is unavailable.
export function loadBest(store = defaultStore()) {
  if (!store) return 0;
  try {
    const v = parseInt(store.getItem(KEY), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

// Persist `score` if it beats the stored best.
// Returns { best, isNewBest } — best is always the value to display.
export function saveBestIfHigher(score, store = defaultStore()) {
  const prev = loadBest(store);
  if (score > prev) {
    if (store) {
      try {
        store.setItem(KEY, String(score));
      } catch (e) {
        // out of quota / unavailable — degrade gracefully, no throw
      }
    }
    return { best: score, isNewBest: true };
  }
  return { best: prev, isNewBest: false };
}

// Mute preference, defaulting to false (sound on) when unavailable.
export function loadMuted(store = defaultStore()) {
  if (!store) return false;
  try {
    return store.getItem(MUTE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function saveMuted(muted, store = defaultStore()) {
  if (!store) return;
  try {
    store.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch (e) {
    // unavailable — degrade gracefully
  }
}

// ============================================================================
// Player profile — progression, unlocks, missions, stats (versioned JSON).
// Best score + mute stay in their own legacy keys (above) so existing callers
// are untouched; the profile carries everything new.
// ============================================================================

// A fresh profile. Kept as a factory so callers always get their own copy.
export function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    coins: 0,
    unlocked: { riders: ["default"], boards: ["default"], spots: ["lake"] },
    equipped: { rider: "default", board: "default", spot: "lake" },
    missions: {}, // id → { progress, done }
    daily: { date: null, done: false },
    stats: { runs: 0, bestCombo: 0, totalScore: 0, tricksLanded: 0 },
  };
}

// Merge a stored (possibly older/partial) profile onto the current defaults so
// new fields always exist. Shallow-merges the nested groups.
function normalizeProfile(raw) {
  const d = defaultProfile();
  if (!raw || typeof raw !== "object") return d;
  return {
    version: PROFILE_VERSION,
    coins: typeof raw.coins === "number" ? raw.coins : d.coins,
    unlocked: { ...d.unlocked, ...(raw.unlocked || {}) },
    equipped: { ...d.equipped, ...(raw.equipped || {}) },
    missions: raw.missions && typeof raw.missions === "object" ? raw.missions : d.missions,
    daily: { ...d.daily, ...(raw.daily || {}) },
    stats: { ...d.stats, ...(raw.stats || {}) },
  };
}

// Load the profile, creating (and migrating from legacy keys) if absent.
export function loadProfile(store = defaultStore()) {
  if (!store) return defaultProfile();
  try {
    const rawStr = store.getItem(PROFILE_KEY);
    if (rawStr) return normalizeProfile(JSON.parse(rawStr));
  } catch (e) {
    // corrupt / unavailable — fall through to a migrated default
  }
  // First run with the profile system: seed a default (best score stays in its
  // own key, so nothing to copy across yet).
  return defaultProfile();
}

// Persist the profile. Degrades gracefully when storage is unavailable/full.
export function saveProfile(profile, store = defaultStore()) {
  if (!store) return;
  try {
    store.setItem(PROFILE_KEY, JSON.stringify({ ...profile, version: PROFILE_VERSION }));
  } catch (e) {
    // out of quota / unavailable — no throw
  }
}
