// Pure Math Slither simulation. No Phaser, no DOM — deterministic per seed.
// The renderer (PlayScene) feeds input + dt in, and reads state + events out.
// This separation is the multiplayer-ready swap point: a server could run this
// exact module.

import { createProblemStream, type Problem, type ProblemStream, type Topic } from './problems';
import { grade } from './grade';
import { createRng, type RNG } from './rng';

// ----- tuning -----------------------------------------------------------------

// Default world size. The actual arena is per-sim (SimOptions.world) so it can
// adapt to the real viewport — see SimState.world, used for eel/orb bounds.
export const ARENA = { width: 1920, height: 1440 } as const;

export const MATCH_SECONDS = 75;
export const WIN_SCORE = 15;
export const URGENT_SECONDS = 10;

/**
 * Live-tunable movement knobs. Read every step (no caching), so you can dial
 * them from the dev console while playing: `__tuning.baseSpeed = 420`.
 * There is NO start-of-match ramp — the eel moves at baseSpeed from tick one.
 */
export const TUNING = {
  baseSpeed: 350, // px/s — cruise speed (was 260)
  turnRate: 6.2, // rad/s — quick, committed turns without feeling twitchy
  // Spawn rev-up: start at rampStartFraction × baseSpeed and ease-out to full
  // cruise over rampSeconds. Never a crawl — just a quick wind-up.
  rampStartFraction: 0.7, // 0.7 × 350 = 245 px/s at t=0
  rampSeconds: 0.7,
};
const SLOW_FACTOR = 0.45; // speed multiplier while slowed after a wrong answer
const SLOW_SECONDS = 1.2;

export const SEGMENT_SPACING = 20; // px between body segments along the path
const START_SEGMENTS = 6;
const MIN_SEGMENTS = 3;
const GROW_PER_CORRECT = 1;
const SHRINK_PER_WRONG = 2;

export const HEAD_RADIUS = 18;
export const ORB_RADIUS = 30;
const ORB_COUNT = 5;
const ORB_MARGIN = 90; // keep orbs off the walls
const ORB_MIN_HEAD_DIST = 260; // don't spawn under the player's nose
const ORB_MIN_ORB_DIST = 170;

const TIER_MIN = 1;
const TIER_MAX = 4;
const TIER_WINDOW = 6; // recompute difficulty every N answers
const TIER_UP_ACCURACY = 0.8;
const TIER_DOWN_ACCURACY = 0.5;

// CPU rival — tuned to be a real but beatable racer to the same WIN_SCORE.
// It targets the correct orb only `accuracy` of the time (else a distractor, so
// it visibly "misses"), reacts with a delay, and is a touch slower than you.
// The rival commits an answer on its own solve cadence (independent of the
// player's pace and the board repositioning). Tuned so over 75s it lands ~13-15
// corrects: a real but beatable racer that visibly misses sometimes.
// NOTE: accuracy + cadence set the SCORING pace; the reaction/feint/wander knobs
// below only shape its STEERING (how it looks), never its score.
const RIVAL_ACCURACY = 0.66; // chance each attempt is correct
const RIVAL_SOLVE_MIN = 3.0; // seconds per attempt (avg ~3.6 → ~21 attempts/75s)
const RIVAL_SOLVE_MAX = 4.2;
const RIVAL_SPEED_FACTOR = 0.92; // vs TUNING.baseSpeed — a touch slower than you
const RIVAL_TURN_FACTOR = 1.1; // vs TUNING.turnRate — locks onto its target orb
// Behaviour flavour (steering only — does not affect score):
const RIVAL_REACT_MIN = 0.35; // hesitation before locking onto a fresh problem
const RIVAL_REACT_MAX = 0.85;
const RIVAL_FEINT_CHANCE = 0.3; // chance it drifts to a wrong orb first, then corrects
const RIVAL_FEINT_MIN = 0.6;
const RIVAL_FEINT_MAX = 1.3;
const RIVAL_WANDER_MAX = 0.42; // rad — heading wobble so it isn't a perfect beeline
const RIVAL_WANDER_RATE = 2.6; // how fast the wobble drifts

// ----- types --------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export interface Orb {
  id: number;
  value: number;
  x: number;
  y: number;
  correct: boolean; // sim-internal; the renderer must not use this to cheat
}

export type SimEvent =
  | { type: 'correct'; value: number; x: number; y: number; score: number; streak: number }
  | { type: 'wrong'; value: number; expected: number; x: number; y: number }
  | { type: 'problem'; problem: Problem }
  | { type: 'tier'; tier: number; dir: 1 | -1 }
  | { type: 'rival'; correct: boolean; x: number; y: number; score: number }
  | { type: 'over'; won: boolean; score: number; rivalScore: number };

/** A CPU-controlled opponent eel sharing the arena. Purely local, no networking. */
export interface RivalState {
  head: Vec2;
  heading: number;
  segments: Vec2[];
  score: number;
  streak: number;
  /**
   * The rival's OWN answer field for the current problem — its own positions and
   * its own correct orb. Hidden from the player (never rendered): same problem
   * means the same correct value, so showing it would leak the answer.
   */
  orbs: Orb[];
  /** the committed real target this attempt (correct orb, or a distractor on a miss) */
  targetOrbId: number | null;
  /** a wrong orb it drifts toward first before correcting (a feint), or null */
  feintOrbId: number | null;
  /** time until it commits this attempt's answer (its own solve cadence) */
  solveLeft: number;
  /** hesitation before locking onto the target after a fresh problem appears */
  reactLeft: number;
  /** remaining feint time (heads to the wrong orb while > 0) */
  feintLeft: number;
  /** smoothly drifting heading offset → imperfect, non-beeline pathing */
  wander: number;
  /** problem id last seen, to regenerate its field + react when a new one appears */
  seenProblemId: number;
  /** outcome decided at the start of the attempt (so it visibly chases the right orb) */
  pendingCorrect: boolean;
  slowLeft: number;
}

export interface SimInput {
  /** desired heading in radians, or null to keep current heading */
  heading: number | null;
}

export interface SimState {
  status: 'playing' | 'over';
  won: boolean;
  /** arena bounds for this match (adapts to the viewport at match start) */
  world: { width: number; height: number };
  /** CPU opponent, or null when the rival is disabled */
  rival: RivalState | null;
  head: Vec2;
  heading: number;
  /** body segment positions, head-most first (excludes the head itself) */
  segments: Vec2[];
  orbs: Orb[];
  problem: Problem;
  score: number;
  streak: number;
  bestStreak: number;
  answered: number;
  correctCount: number;
  tier: number;
  timeLeft: number;
  slowLeft: number;
}

// ----- sim ---------------------------------------------------------------------

export interface SimOptions {
  /** math-pack topic pool; defaults to the mixed mul+add/sub stream */
  topics?: readonly Topic[];
  /** difficulty: starting tier (default 1) and tier ceiling (default 4) */
  startTier?: number;
  maxTier?: number;
  /** arena bounds; defaults to ARENA. Pass viewport-derived size for resize mode. */
  world?: { width: number; height: number };
  /** spawn a local CPU rival in the arena (default false) */
  rival?: boolean;
}

export class Sim {
  readonly state: SimState;

  private rng: RNG;
  private stream: ProblemStream;
  private readonly maxTier: number;
  private nextOrbId = 0;
  /** sampled head path for the tail to follow; index 0 = newest */
  private path: Vec2[] = [];
  /** recycled path points — avoids a per-frame allocation in step() */
  private pathPool: Vec2[] = [];
  private windowAnswered = 0;
  private windowCorrect = 0;
  /** rival's own sampled head path (its tail follows it) */
  private rivalPath: Vec2[] = [];
  private rivalPathPool: Vec2[] = [];

  constructor(seed: number, opts: SimOptions = {}) {
    this.rng = createRng(seed);
    this.stream = createProblemStream(seed, opts.topics);
    const startTier = clamp(Math.round(opts.startTier ?? TIER_MIN), TIER_MIN, TIER_MAX);
    this.maxTier = clamp(Math.round(opts.maxTier ?? TIER_MAX), startTier, TIER_MAX);

    const world = {
      width: Math.round(opts.world?.width ?? ARENA.width),
      height: Math.round(opts.world?.height ?? ARENA.height),
    };
    const head = { x: world.width / 2, y: world.height / 2 };
    const problem = this.stream.next(startTier);

    this.state = {
      status: 'playing',
      won: false,
      world,
      rival: null,
      head,
      heading: 0, // set below, once orbs exist
      segments: [],
      orbs: [],
      problem,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answered: 0,
      correctCount: 0,
      tier: startTier,
      timeLeft: MATCH_SECONDS,
      slowLeft: 0,
    };

    this.spawnOrbs(problem);

    // Spawn aimed at the nearest orb — full speed toward something visible from
    // the very first frame, instead of a random wander while the player orients.
    let nearest = this.state.orbs[0];
    for (const o of this.state.orbs) {
      if (
        Math.hypot(o.x - head.x, o.y - head.y) < Math.hypot(nearest.x - head.x, nearest.y - head.y)
      ) {
        nearest = o;
      }
    }
    this.state.heading = Math.atan2(nearest.y - head.y, nearest.x - head.x);

    // seed the path straight behind the head so segments have somewhere to sit
    const back = this.state.heading + Math.PI;
    for (let i = 0; i <= START_SEGMENTS * SEGMENT_SPACING; i += 4) {
      this.path.push({ x: head.x + Math.cos(back) * i, y: head.y + Math.sin(back) * i });
    }
    for (let i = 0; i < START_SEGMENTS; i++) this.state.segments.push({ ...head });
    this.layoutSegments();

    if (opts.rival) this.initRival();
  }

  /** Spawn the CPU rival in a corner, aimed inward, with a short initial delay. */
  private initRival(): void {
    const { width: w, height: h } = this.state.world;
    const head = { x: w * 0.2, y: h * 0.78 };
    const heading = Math.atan2(h / 2 - head.y, w / 2 - head.x);
    const segments: Vec2[] = [];
    for (let i = 0; i < START_SEGMENTS; i++) segments.push({ ...head });
    const back = heading + Math.PI;
    for (let i = 0; i <= START_SEGMENTS * SEGMENT_SPACING; i += 4) {
      this.rivalPath.push({ x: head.x + Math.cos(back) * i, y: head.y + Math.sin(back) * i });
    }
    this.state.rival = {
      head,
      heading,
      segments,
      score: 0,
      streak: 0,
      orbs: [],
      targetOrbId: null,
      feintOrbId: null,
      solveLeft: 0,
      reactLeft: 0,
      feintLeft: 0,
      wander: 0,
      seenProblemId: this.state.problem.id,
      pendingCorrect: false,
      slowLeft: 0,
    };
    this.state.rival.orbs = this.makeOrbField(this.state.problem, head); // its own hidden field
    this.startRivalAttempt(this.state.rival, 1.0); // small head start before the first answer
    this.layoutRival();
  }

  /** Begin a fresh attempt: re-lay its own field, decide outcome, target, feint. */
  private startRivalAttempt(r: RivalState, extraDelay = 0): void {
    r.orbs = this.makeOrbField(this.state.problem, r.head); // fresh positions each attempt
    r.pendingCorrect = this.rng.next() < RIVAL_ACCURACY;
    r.solveLeft = extraDelay + RIVAL_SOLVE_MIN + this.rng.next() * (RIVAL_SOLVE_MAX - RIVAL_SOLVE_MIN);
    r.reactLeft = RIVAL_REACT_MIN + this.rng.next() * (RIVAL_REACT_MAX - RIVAL_REACT_MIN);
    r.targetOrbId = this.rivalRealTargetId(r);

    // On a winning attempt, occasionally drift toward a wrong orb first, then
    // correct. Capped well under the solve time so the correction reads clearly.
    if (r.pendingCorrect && this.rng.next() < RIVAL_FEINT_CHANCE) {
      r.feintOrbId = this.rivalDistractorId(r);
      r.feintLeft = Math.min(
        RIVAL_FEINT_MIN + this.rng.next() * (RIVAL_FEINT_MAX - RIVAL_FEINT_MIN),
        r.solveLeft * 0.5
      );
    } else {
      r.feintOrbId = null;
      r.feintLeft = 0;
    }
  }

  /** The committed real target this attempt: the rival's OWN correct orb, or a distractor on a miss. */
  private rivalRealTargetId(r: RivalState): number | null {
    if (r.orbs.length === 0) return null;
    if (r.pendingCorrect) {
      const correct = r.orbs.find((o) => o.correct);
      if (correct) return correct.id;
    }
    return this.rivalDistractorId(r) ?? r.orbs[0].id;
  }

  private rivalDistractorId(r: RivalState): number | null {
    const distractors = r.orbs.filter((o) => !o.correct);
    return distractors.length > 0 ? this.rng.pick(distractors).id : null;
  }

  /** Advance the sim by dt seconds. Returns the events that happened this tick. */
  step(dt: number, input: SimInput): SimEvent[] {
    const s = this.state;
    if (s.status !== 'playing') return [];
    const events: SimEvent[] = [];

    // --- timer
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    if (s.timeLeft === 0) {
      // timer end: win if you're ahead of (or tied with) the rival; in pure
      // solo (no rival) keep the original "reached the target" rule.
      const won = s.rival ? s.score >= s.rival.score : s.score >= WIN_SCORE;
      this.endMatch(won, events);
      return events;
    }

    // --- steering: turn toward desired heading at a capped rate
    if (input.heading !== null) {
      const diff = wrapAngle(input.heading - s.heading);
      const maxTurn = TUNING.turnRate * dt;
      s.heading = wrapAngle(s.heading + clamp(diff, -maxTurn, maxTurn));
    }

    // --- movement
    if (s.slowLeft > 0) s.slowLeft = Math.max(0, s.slowLeft - dt);
    // spawn rev-up: ease-out from rampStartFraction to 1 over rampSeconds
    const elapsed = MATCH_SECONDS - s.timeLeft;
    const p = Math.min(1, elapsed / Math.max(TUNING.rampSeconds, 0.001));
    const eased = 1 - (1 - p) * (1 - p); // quad ease-out — fast early gains
    const ramp = TUNING.rampStartFraction + (1 - TUNING.rampStartFraction) * eased;
    const speed = TUNING.baseSpeed * ramp * (s.slowLeft > 0 ? SLOW_FACTOR : 1);
    s.head.x += Math.cos(s.heading) * speed * dt;
    s.head.y += Math.sin(s.heading) * speed * dt;

    // soft wall: clamp position and slide the heading along the wall
    s.head.x = clamp(s.head.x, HEAD_RADIUS, s.world.width - HEAD_RADIUS);
    s.head.y = clamp(s.head.y, HEAD_RADIUS, s.world.height - HEAD_RADIUS);

    // --- record path + lay out tail
    const last = this.path[0];
    const moved = last ? Math.hypot(s.head.x - last.x, s.head.y - last.y) : Infinity;
    if (moved >= 3) {
      const p = this.pathPool.pop() ?? { x: 0, y: 0 };
      p.x = s.head.x;
      p.y = s.head.y;
      this.path.unshift(p);
    }
    const maxPathLen = Math.ceil(((s.segments.length + 2) * SEGMENT_SPACING) / 3) + 8;
    while (this.path.length > maxPathLen) this.pathPool.push(this.path.pop()!);
    this.layoutSegments();

    // --- orb collisions
    const hit = s.orbs.find(
      (o) => Math.hypot(o.x - s.head.x, o.y - s.head.y) <= HEAD_RADIUS + ORB_RADIUS
    );
    if (hit) this.resolveOrb(hit, events);
    if (s.status !== 'playing') return events; // player just hit the target

    // --- rival
    this.stepRival(dt, events);

    return events;
  }

  /**
   * Advance the CPU rival. It hesitates briefly when a new problem appears,
   * sometimes feints toward a wrong orb before correcting, and steers with a
   * little wobble so its path isn't a perfect beeline. It commits the answer
   * when its own solve timer elapses — decoupled from the player's pace and the
   * board. All of this is STEERING flavour; the score/pace is unchanged.
   */
  private stepRival(dt: number, events: SimEvent[]): void {
    const s = this.state;
    const r = s.rival;
    if (!r) return;

    if (r.slowLeft > 0) r.slowLeft = Math.max(0, r.slowLeft - dt);
    if (r.feintLeft > 0) r.feintLeft = Math.max(0, r.feintLeft - dt);

    // the shared problem advanced (player scored) → re-lay its own field on the
    // new (same) problem, hesitate, then re-lock
    if (s.problem.id !== r.seenProblemId) {
      r.seenProblemId = s.problem.id;
      r.orbs = this.makeOrbField(s.problem, r.head);
      r.reactLeft = Math.max(r.reactLeft, RIVAL_REACT_MIN + this.rng.next() * (RIVAL_REACT_MAX - RIVAL_REACT_MIN));
      r.targetOrbId = this.rivalRealTargetId(r);
      if (r.feintLeft > 0) r.feintOrbId = this.rivalDistractorId(r);
    }
    if (r.reactLeft > 0) r.reactLeft = Math.max(0, r.reactLeft - dt);

    // smooth heading wobble (Ornstein–Uhlenbeck-ish) for imperfect pathing
    r.wander = clamp(
      r.wander * (1 - 1.6 * dt) + (this.rng.next() * 2 - 1) * RIVAL_WANDER_RATE * dt,
      -RIVAL_WANDER_MAX,
      RIVAL_WANDER_MAX
    );

    // pick what to steer toward this frame, in the rival's OWN field:
    // hesitate → feint orb → real target
    let aimId: number | null;
    if (r.reactLeft > 0) {
      aimId = null; // hesitating: drift, don't lock on yet
    } else if (r.feintLeft > 0) {
      if (r.feintOrbId === null || !r.orbs.some((o) => o.id === r.feintOrbId)) {
        r.feintOrbId = this.rivalDistractorId(r);
      }
      aimId = r.feintOrbId;
    } else {
      if (r.targetOrbId === null || !r.orbs.some((o) => o.id === r.targetOrbId)) {
        r.targetOrbId = this.rivalRealTargetId(r);
      }
      aimId = r.targetOrbId;
    }

    const target = aimId !== null ? r.orbs.find((o) => o.id === aimId) : undefined;
    const maxTurn = TUNING.turnRate * RIVAL_TURN_FACTOR * dt;
    if (target) {
      const desired = Math.atan2(target.y - r.head.y, target.x - r.head.x) + r.wander;
      const diff = wrapAngle(desired - r.heading);
      r.heading = wrapAngle(r.heading + clamp(diff, -maxTurn, maxTurn));
    } else {
      // hesitating with no lock: meander gently using the wobble
      r.heading = wrapAngle(r.heading + r.wander * dt * 2.2);
    }

    // move
    const speed = TUNING.baseSpeed * RIVAL_SPEED_FACTOR * (r.slowLeft > 0 ? SLOW_FACTOR : 1);
    r.head.x = clamp(r.head.x + Math.cos(r.heading) * speed * dt, HEAD_RADIUS, s.world.width - HEAD_RADIUS);
    r.head.y = clamp(r.head.y + Math.sin(r.heading) * speed * dt, HEAD_RADIUS, s.world.height - HEAD_RADIUS);

    // path + tail
    const last = this.rivalPath[0];
    const moved = last ? Math.hypot(r.head.x - last.x, r.head.y - last.y) : Infinity;
    if (moved >= 3) {
      const p = this.rivalPathPool.pop() ?? { x: 0, y: 0 };
      p.x = r.head.x;
      p.y = r.head.y;
      this.rivalPath.unshift(p);
    }
    const maxPathLen = Math.ceil(((r.segments.length + 2) * SEGMENT_SPACING) / 3) + 8;
    while (this.rivalPath.length > maxPathLen) this.rivalPathPool.push(this.rivalPath.pop()!);
    this.layoutRival();

    // commit the answer when the solve timer elapses
    r.solveLeft -= dt;
    if (r.solveLeft <= 0) this.rivalAnswer(r, events);
  }

  private rivalAnswer(r: RivalState, events: SimEvent[]): void {
    if (r.pendingCorrect) {
      r.score++;
      r.streak++;
      const tail = r.segments[r.segments.length - 1] ?? r.head;
      r.segments.push({ ...tail });
      events.push({ type: 'rival', correct: true, x: r.head.x, y: r.head.y, score: r.score });
      if (r.score >= WIN_SCORE) {
        this.endMatch(false, events); // rival reached the target first → you lose
        return;
      }
      this.startRivalAttempt(r);
    } else {
      r.streak = 0;
      r.slowLeft = SLOW_SECONDS;
      const keep = Math.max(MIN_SEGMENTS, r.segments.length - SHRINK_PER_WRONG);
      r.segments.length = keep;
      events.push({ type: 'rival', correct: false, x: r.head.x, y: r.head.y, score: r.score });
      this.startRivalAttempt(r, SLOW_SECONDS); // a beat slower after a miss
    }
  }

  // ----- internals ---------------------------------------------------------------

  private resolveOrb(orb: Orb, events: SimEvent[]): void {
    const s = this.state;
    const verdict = grade(s.problem, orb.value); // the one and only answer check

    s.answered++;
    this.windowAnswered++;

    if (verdict.correct) {
      s.score++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.correctCount++;
      this.windowCorrect++;
      for (let i = 0; i < GROW_PER_CORRECT; i++) {
        const tail = s.segments[s.segments.length - 1] ?? s.head;
        s.segments.push({ ...tail });
      }
      events.push({
        type: 'correct',
        value: orb.value,
        x: orb.x,
        y: orb.y,
        score: s.score,
        streak: s.streak,
      });

      this.maybeRetier(events);

      if (s.score >= WIN_SCORE) {
        this.endMatch(true, events);
        return;
      }

      s.problem = this.stream.next(s.tier);
      events.push({ type: 'problem', problem: s.problem });
      this.spawnOrbs(s.problem);
    } else {
      s.streak = 0;
      s.slowLeft = SLOW_SECONDS;
      const keep = Math.max(MIN_SEGMENTS, s.segments.length - SHRINK_PER_WRONG);
      s.segments.length = keep;
      // the wrong orb is consumed — fewer choices remain, problem stays up
      s.orbs = s.orbs.filter((o) => o.id !== orb.id);
      events.push({
        type: 'wrong',
        value: orb.value,
        expected: s.problem.correct,
        x: orb.x,
        y: orb.y,
      });
      this.maybeRetier(events);
    }
  }

  private maybeRetier(events: SimEvent[]): void {
    if (this.windowAnswered < TIER_WINDOW) return;
    const accuracy = this.windowCorrect / this.windowAnswered;
    const s = this.state;
    if (accuracy >= TIER_UP_ACCURACY && s.tier < this.maxTier) {
      s.tier++;
      events.push({ type: 'tier', tier: s.tier, dir: 1 });
    } else if (accuracy <= TIER_DOWN_ACCURACY && s.tier > TIER_MIN) {
      s.tier--;
      events.push({ type: 'tier', tier: s.tier, dir: -1 });
    }
    this.windowAnswered = 0;
    this.windowCorrect = 0;
  }

  private endMatch(won: boolean, events: SimEvent[]): void {
    const s = this.state;
    s.status = 'over';
    s.won = won;
    events.push({ type: 'over', won, score: s.score, rivalScore: s.rival?.score ?? 0 });
  }

  private spawnOrbs(problem: Problem): void {
    this.state.orbs = this.makeOrbField(problem, this.state.head);
  }

  /**
   * Build ONE racer's answer field for `problem` — same correct value + the same
   * distractors as everyone (fair), but at this racer's own positions, placed
   * clear of `avoid` (their own head) and each other. Each racer calls this
   * independently, so there is no shared field to read off. Multiplayer-ready:
   * N racers = N independent fields.
   */
  private makeOrbField(problem: Problem, avoid: Vec2): Orb[] {
    const values = this.rng.shuffle([problem.correct, ...problem.distractors]);
    const placed: Vec2[] = [];
    return values.slice(0, ORB_COUNT).map((value) => {
      const pos = this.findOrbSpot(placed, avoid);
      placed.push(pos);
      return {
        id: this.nextOrbId++,
        value,
        x: pos.x,
        y: pos.y,
        correct: value === problem.correct,
      };
    });
  }

  private findOrbSpot(placed: Vec2[], avoid: Vec2): Vec2 {
    const s = this.state;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = this.rng.int(ORB_MARGIN, s.world.width - ORB_MARGIN);
      const y = this.rng.int(ORB_MARGIN, s.world.height - ORB_MARGIN);
      const headOk = Math.hypot(x - avoid.x, y - avoid.y) >= ORB_MIN_HEAD_DIST;
      const orbsOk = placed.every((p) => Math.hypot(x - p.x, y - p.y) >= ORB_MIN_ORB_DIST);
      if (headOk && orbsOk) return { x, y };
    }
    // degenerate fallback: anywhere inside the margin
    return {
      x: this.rng.int(ORB_MARGIN, s.world.width - ORB_MARGIN),
      y: this.rng.int(ORB_MARGIN, s.world.height - ORB_MARGIN),
    };
  }

  /** Place each segment at (i+1)*SPACING behind the head along the recorded path. */
  private layoutSegments(): void {
    layoutChain(this.state.head, this.state.segments, this.path);
  }

  private layoutRival(): void {
    if (this.state.rival) layoutChain(this.state.rival.head, this.state.rival.segments, this.rivalPath);
  }
}

// ----- helpers -------------------------------------------------------------------

/** Place each segment at (i+1)*SPACING behind the head along the recorded path. */
function layoutChain(head: Vec2, segments: Vec2[], pts: Vec2[]): void {
  if (pts.length === 0) return;
  let segIndex = 0;
  let target = SEGMENT_SPACING;
  let travelled = 0;
  let prev = { x: head.x, y: head.y };

  for (let i = 0; i < pts.length && segIndex < segments.length; i++) {
    const pt = pts[i];
    const d = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    while (travelled + d >= target && segIndex < segments.length) {
      const t = d === 0 ? 0 : (target - travelled) / d;
      segments[segIndex].x = prev.x + (pt.x - prev.x) * t;
      segments[segIndex].y = prev.y + (pt.y - prev.y) * t;
      segIndex++;
      target += SEGMENT_SPACING;
    }
    travelled += d;
    prev = pt;
  }
  const end = pts[pts.length - 1];
  for (; segIndex < segments.length; segIndex++) {
    segments[segIndex].x = end.x;
    segments[segIndex].y = end.y;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** wrap to (-PI, PI] */
function wrapAngle(a: number): number {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}
