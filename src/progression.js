// ============================================================================
// Cable Rush — progression: missions, run rewards, daily challenge. Pure (zero
// Phaser), evaluated from a run summary against the stored profile so it is
// fully unit-testable, in the style of modules.js / difficulty.js.
//
// A run summary is the shape GameScene builds at the end of a run:
//   { score, bestCombo, tricksLanded, wipeouts }
// ============================================================================

// Coins earned from a run (rounded). Simple, legible: 1 coin per 100 points.
export function coinsForRun(summary) {
  return Math.max(0, Math.floor((summary.score || 0) / 100));
}

// Mission catalogue. Each maps a run-summary field to a target; a mission is
// "done" once the value in a single run reaches the target (one-shot rewards).
export const MISSIONS = [
  { id: "land10", name: "Enchaîne 10 tricks dans un run", field: "tricksLanded", target: 10, reward: 200 },
  { id: "combo5", name: "Atteins un combo x5", field: "bestCombo", target: 5, reward: 300 },
  { id: "score10k", name: "Score 10 000 en un run", field: "score", target: 10000, reward: 500 },
  { id: "clean", name: "Un run sans wipeout (score ≥ 3000)", field: "cleanRun", target: 1, reward: 400 },
];

// Derive the value used to test a mission from a run summary.
function fieldValue(summary, field) {
  if (field === "cleanRun") {
    return (summary.wipeouts || 0) === 0 && (summary.score || 0) >= 3000 ? 1 : 0;
  }
  return summary[field] || 0;
}

// Evaluate all missions for a finished run against the profile's mission record.
// Returns { missions, coinsAwarded, completed } WITHOUT mutating inputs:
//   missions      — the updated mission record (id → { done })
//   coinsAwarded   — coins from newly-completed missions
//   completed      — names of missions completed THIS run (for the summary UI)
export function evaluateMissions(summary, profile) {
  const record = { ...((profile && profile.missions) || {}) };
  let coinsAwarded = 0;
  const completed = [];
  for (const m of MISSIONS) {
    if (record[m.id] && record[m.id].done) continue; // already earned
    if (fieldValue(summary, m.field) >= m.target) {
      record[m.id] = { done: true };
      coinsAwarded += m.reward;
      completed.push(m.name);
    }
  }
  return { missions: record, coinsAwarded, completed };
}

// Apply a finished run to a profile: bank coins (run + missions), bump stats,
// mark completed missions. Returns { profile, coinsAwarded, completed } with a
// NEW profile object (pure).
export function applyRun(summary, profile) {
  const { missions, coinsAwarded, completed } = evaluateMissions(summary, profile);
  const runCoins = coinsForRun(summary);
  const total = runCoins + coinsAwarded;
  const stats = profile.stats || {};
  const next = {
    ...profile,
    coins: (profile.coins || 0) + total,
    missions,
    stats: {
      ...stats,
      runs: (stats.runs || 0) + 1,
      totalScore: (stats.totalScore || 0) + (summary.score || 0),
      tricksLanded: (stats.tricksLanded || 0) + (summary.tricksLanded || 0),
      bestCombo: Math.max(stats.bestCombo || 0, summary.bestCombo || 0),
    },
  };
  return { profile: next, coinsAwarded: total, runCoins, missionCoins: coinsAwarded, completed };
}

// Deterministic daily-challenge seed from a YYYY-MM-DD date string. Same date →
// same seed → same run layout, so a "daily" is a shared, repeatable challenge.
export function dailyChallengeFor(dateStr) {
  let h = 2166136261;
  const s = String(dateStr || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return { date: s, seed: (h >>> 0).toString(36) };
}
