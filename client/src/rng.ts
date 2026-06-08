// Seeded RNG (mulberry32). The whole sim + problem stream is driven by this so
// a match is deterministic per seed — the property a future vs-score mode needs.

export interface RNG {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** pick one element */
  pick<T>(arr: readonly T[]): T;
  /** shuffle a copy */
  shuffle<T>(arr: readonly T[]): T[];
}

export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
