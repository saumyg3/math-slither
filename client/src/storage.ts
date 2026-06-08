// Session-best persistence. localStorage can throw (private mode, blocked
// third-party storage) — never let that take the game down.

const BEST_KEY = 'math-slither-best';

export function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** Persist the high-water mark; returns the (possibly unchanged) best. */
export function saveBest(score: number): number {
  const best = Math.max(loadBest(), score);
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* storage unavailable — session-only */
  }
  return best;
}
