// ============================================================================
// Cable Rush — persistent best score (localStorage), with graceful fallback
// when storage is unavailable (private mode, disabled, server/test env).
// The `store` param is injectable so the logic is unit-testable without a DOM.
// ============================================================================
const KEY = "cable-rush:best";
const MUTE_KEY = "cable-rush:muted";

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
