// The ONLY place answers are checked. Local stand-in for the platform's
// server-authoritative `submitAttempt()` — swap this module's internals for a
// bridge call later and nothing else changes.

import type { Problem } from './problems';

export interface Verdict {
  correct: boolean;
  expected: number;
  chosen: number;
}

export function grade(problem: Problem, chosen: number): Verdict {
  return { correct: chosen === problem.correct, expected: problem.correct, chosen };
}
