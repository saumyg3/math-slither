// Seeded problem stream. nextProblem(tier) -> { stem, latex, correct, distractors }.
// Default topics: multiplication + addition/subtraction (per the shape note).
// Distractors are plausible near-misses (off-by-one facts, sign slips, place-value
// slips), never random noise. No Phaser, no DOM.

import { createRng, type RNG } from './rng';

export interface Problem {
  id: number;
  /** plain-text stem, e.g. "7 × 8" */
  stem: string;
  /** KaTeX source for the HUD, e.g. "7 \\times 8" */
  latex: string;
  correct: number;
  /** 4 unique plausible wrong answers */
  distractors: number[];
}

export interface ProblemStream {
  next(tier: number): Problem;
}

export type Topic = 'mul' | 'add' | 'sub';

/** Weighted default mix; pass explicit topics for a math-pack selection. */
const DEFAULT_TOPICS: readonly Topic[] = ['mul', 'mul', 'add', 'sub'];

export function createProblemStream(seed: number, topics?: readonly Topic[]): ProblemStream {
  const rng = createRng(seed ^ 0x9e3779b9);
  const pool = topics && topics.length > 0 ? topics : DEFAULT_TOPICS;
  let id = 0;

  return {
    next(tier: number): Problem {
      const t = clampTier(tier);
      const topic: Topic = rng.pick(pool);
      const p = topic === 'mul' ? makeMul(rng, t) : makeAddSub(rng, t, topic);
      return { id: id++, ...p };
    },
  };
}

function clampTier(tier: number): number {
  return Math.max(1, Math.min(4, Math.round(tier)));
}

interface Core {
  stem: string;
  latex: string;
  correct: number;
  distractors: number[];
}

function makeMul(rng: RNG, tier: number): Core {
  let a: number, b: number;
  switch (tier) {
    case 1: // early tables
      a = rng.int(2, 5);
      b = rng.int(2, 9);
      break;
    case 2: // full single-digit tables
      a = rng.int(3, 9);
      b = rng.int(3, 9);
      break;
    case 3: // up to 12s
      a = rng.int(6, 12);
      b = rng.int(4, 12);
      break;
    default: // two-digit × one-digit
      a = rng.int(12, 25);
      b = rng.int(3, 9);
      break;
  }
  const correct = a * b;
  const distractors = pickDistractors(rng, correct, [
    (a + 1) * b, // off-by-one fact
    (a - 1) * b,
    a * (b + 1),
    a * (b - 1),
    a + b, // added instead of multiplied
    correct + rng.int(1, 3),
    correct - rng.int(1, 3),
    correct + 10,
  ]);
  return {
    stem: `${a} × ${b}`,
    latex: `${a} \\times ${b}`,
    correct,
    distractors,
  };
}

function makeAddSub(rng: RNG, tier: number, topic: 'add' | 'sub'): Core {
  let a: number, b: number;
  switch (tier) {
    case 1: // within 20
      a = rng.int(3, 12);
      b = rng.int(2, 8);
      break;
    case 2: // within 50, no regrouping pressure
      a = rng.int(10, 40);
      b = rng.int(5, 20);
      break;
    case 3: // within 100
      a = rng.int(20, 80);
      b = rng.int(10, 50);
      break;
    default: // within 100, regrouping likely
      a = rng.int(35, 99);
      b = rng.int(17, 65);
      break;
  }
  if (topic === 'sub' && b > a) [a, b] = [b, a]; // keep results non-negative for grades 3–6
  const correct = topic === 'add' ? a + b : a - b;
  const sign = topic === 'add' ? '+' : '−';
  const distractors = pickDistractors(rng, correct, [
    correct + 1, // off-by-one
    correct - 1,
    correct + 10, // place-value slip
    correct - 10,
    topic === 'add' ? a - b : a + b, // wrong operation
    correct + 2,
    correct - 2,
  ]);
  return {
    stem: `${a} ${sign} ${b}`,
    latex: `${a} ${topic === 'add' ? '+' : '-'} ${b}`,
    correct,
    distractors,
  };
}

/** Choose 4 unique, non-negative distractors ≠ correct from the candidate pool. */
function pickDistractors(rng: RNG, correct: number, candidates: number[]): number[] {
  const pool = rng.shuffle(candidates);
  const out: number[] = [];
  for (const c of pool) {
    if (c === correct || c < 0 || out.includes(c)) continue;
    out.push(c);
    if (out.length === 4) return out;
  }
  // Fallback: pad with nearby offsets until we have 4 (rare).
  let offset = 3;
  while (out.length < 4) {
    for (const c of [correct + offset, correct - offset]) {
      if (c !== correct && c >= 0 && !out.includes(c) && out.length < 4) out.push(c);
    }
    offset++;
  }
  return out;
}
