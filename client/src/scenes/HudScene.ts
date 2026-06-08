// In-match DOM HUD, matched to the Claude Design reference: glass score and
// streak panels (top-left), the Solve & Steer stem with a glowing underline
// (top-center, KaTeX — never hand-typeset), a circular ring timer (top-right),
// the Players leaderboard (right edge), and the mode pill + eel-length bar
// (bottom-left). PlayScene pushes state in; all updates are cached so the DOM
// is only touched on change. Every data-testid is preserved from M1.

import Phaser from 'phaser';
import katex from 'katex';
import { audio } from '../audio';
import { WIN_SCORE } from '../game';
import { el, retrigger } from '../hud/dom';
import { mountScreen } from '../hud/overlay';
import { injectStyles } from '../hud/styles';

const RING_CIRCUMFERENCE = 150.8; // 2π × r24, mirrored in the stroke-dasharray CSS
const LENGTH_CELLS = 12;

const HUD_HTML = /* html */ `
<div class="hud-root" data-testid="hud-root">
  <div class="score-panel glass">
    <div class="score-num" data-testid="hud-score">0</div>
    <div class="score-meta">
      <div class="hud-label">Score</div>
      <div class="score-sub">to ${WIN_SCORE} = win</div>
    </div>
  </div>
  <div class="streak-panel glass">
    <span class="streak-dot"></span>
    <span class="streak-num" data-testid="hud-streak">0</span>
    <span class="streak-word">streak</span>
  </div>

  <div class="solve-label">Solve &amp; Steer</div>
  <div class="stem-panel" data-testid="stem-panel">
    <div class="stem" data-testid="problem-stem"></div>
    <div class="stem-underline"></div>
  </div>
  <div class="stem-hint"><span class="hint-dot"></span> Glide onto the orb with the answer</div>

  <div class="timer-panel glass" data-testid="hud-timer-panel">
    <svg class="timer-ring" viewBox="0 0 56 56">
      <circle class="ring-bg" cx="28" cy="28" r="24"></circle>
      <circle class="ring-fg" cx="28" cy="28" r="24"></circle>
    </svg>
    <div class="timer-meta">
      <span class="timer-value" data-testid="hud-timer">75</span>
      <span class="hud-label">Time left</span>
    </div>
  </div>

  <aside class="leaderboard glass" data-testid="leaderboard-panel">
    <header class="lb-header">
      <span class="hud-label">Players</span>
      <button class="lb-toggle" data-testid="leaderboard-toggle" title="Collapse">&rsaquo;</button>
    </header>
    <ul class="lb-rows" data-testid="leaderboard-rows">
      <li class="lb-row" data-testid="leaderboard-row-you">
        <span class="lb-rank" data-rank>1</span>
        <span class="lb-swatch" style="--c:#3FE0D0"></span>
        <span class="lb-name">You</span>
        <span class="lb-score" data-testid="leaderboard-score-you">0</span>
      </li>
      <li class="lb-row" data-testid="leaderboard-row-cpu" hidden>
        <span class="lb-rank" data-rank>2</span>
        <span class="lb-swatch" style="--c:#FF4FA3"></span>
        <span class="lb-name">CPU &middot; Angler</span>
        <span class="lb-score" data-testid="leaderboard-score-cpu">0</span>
      </li>
    </ul>
  </aside>

  <div class="mode-pill-hud glass" data-testid="hud-mode">
    <span class="mode-dot"></span>
    <span class="mode-pill-text">Solo</span>
  </div>
  <div class="length-panel glass">
    <div class="length-head">
      <span class="hud-label">Eel length &middot; HP</span>
      <span class="length-value" data-testid="hud-length">6</span>
    </div>
    <div class="length-cells"></div>
  </div>

  <button class="mute-btn" data-testid="mute-toggle" title="Mute">
    <svg class="icon-on" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>
    <svg class="icon-off" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M19.6 8.6l-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4-2.2-2.2 2.2-2.2z"/></svg>
  </button>

  <!-- typed input + tap-able choices: hidden fallback for flat mode / a11y (per the brief) -->
  <div class="answer-fallback glass" data-testid="answer-fallback">
    <input class="typed-answer" data-testid="typed-answer-input" inputmode="numeric" placeholder="Type your answer" />
    <div class="answer-choices" data-testid="answer-choices">
      <button data-testid="answer-choice-0"></button>
      <button data-testid="answer-choice-1"></button>
      <button data-testid="answer-choice-2"></button>
      <button data-testid="answer-choice-3"></button>
      <button data-testid="answer-choice-4"></button>
    </div>
  </div>
</div>
`;

export class HudScene extends Phaser.Scene {
  private stemEl!: HTMLElement;
  private stemPanel!: HTMLElement;
  private scoreEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private timerPanel!: HTMLElement;
  private ringFg!: SVGCircleElement;
  private streakEl!: HTMLElement;
  private lengthEl!: HTMLElement;
  private lengthCells: HTMLElement[] = [];
  private lbScoreEl!: HTMLElement;
  private lbRowsEl!: HTMLElement;
  private lbRowYou!: HTMLElement;
  private lbRowCpu!: HTMLElement;
  private lbScoreCpuEl!: HTMLElement;
  private modePillEl!: HTMLElement;
  private choiceEls: HTMLElement[] = [];

  private lastScore = -1;
  private lastStreak = -1;
  private lastLength = -1;
  private lastTimerSec = -1;
  private lastFill = -1;
  private lastLbYou = -1;
  private lastLbCpu = -2; // -2 so the first "no rival" push (-1) still applies

  constructor() {
    super('Hud');
  }

  create(): void {
    injectStyles();
    const root = el(HUD_HTML);
    mountScreen(this, root);

    const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement;
    this.stemEl = q('[data-testid="problem-stem"]');
    this.stemPanel = q('[data-testid="stem-panel"]');
    this.scoreEl = q('[data-testid="hud-score"]');
    this.timerEl = q('[data-testid="hud-timer"]');
    this.timerPanel = q('[data-testid="hud-timer-panel"]');
    this.ringFg = root.querySelector('.ring-fg') as SVGCircleElement;
    this.streakEl = q('[data-testid="hud-streak"]');
    this.lengthEl = q('[data-testid="hud-length"]');
    this.lbScoreEl = q('[data-testid="leaderboard-score-you"]');
    this.lbRowsEl = q('[data-testid="leaderboard-rows"]');
    this.lbRowYou = q('[data-testid="leaderboard-row-you"]');
    this.lbRowCpu = q('[data-testid="leaderboard-row-cpu"]');
    this.lbScoreCpuEl = q('[data-testid="leaderboard-score-cpu"]');
    this.modePillEl = q('.mode-pill-text');
    this.choiceEls = Array.from({ length: 5 }, (_, i) => q(`[data-testid="answer-choice-${i}"]`));

    // segmented eel-length bar
    const cells = q('.length-cells');
    this.lengthCells = Array.from({ length: LENGTH_CELLS }, () => {
      const c = document.createElement('span');
      c.className = 'length-cell';
      cells.appendChild(c);
      return c;
    });

    // leaderboard collapse (solo affordance per the brief)
    const lb = q('[data-testid="leaderboard-panel"]');
    const toggle = q('[data-testid="leaderboard-toggle"]');
    toggle.addEventListener('click', () => {
      const collapsed = lb.classList.toggle('collapsed');
      toggle.title = collapsed ? 'Expand' : 'Collapse';
    });

    // small corner mute control; mutes EVERYTHING (synth engine + Phaser),
    // and the choice persists across matches
    const mute = q('[data-testid="mute-toggle"]');
    const applyMute = (muted: boolean): void => {
      audio.setMuted(muted);
      this.sound.mute = muted;
      mute.classList.toggle('muted', muted);
      mute.title = muted ? 'Unmute' : 'Mute';
    };
    applyMute((this.registry.get('muted') as boolean) ?? false);
    mute.addEventListener('click', () => {
      const muted = !this.sound.mute;
      this.registry.set('muted', muted);
      applyMute(muted);
    });

    this.lastScore = -1;
    this.lastStreak = -1;
    this.lastLength = -1;
    this.lastTimerSec = -1;
    this.lastFill = -1;
    this.lastLbYou = -1;
    this.lastLbCpu = -2;
    // Fires once per scene life, AFTER this life's DOM exists — the only safe
    // signal for PlayScene to bind on (a ready flag would go stale across
    // restarts and produce the empty-stem bug).
    this.events.emit('hud-ready');
  }

  /** Bottom-left mode pill, e.g. "Solo · Multiply · Standard". */
  setMode(text: string): void {
    this.modePillEl.textContent = text;
  }

  /**
   * Live opponent leaderboard, sorted high→low. cpu === null hides the CPU row
   * (pure solo); otherwise You vs CPU with rank numbers and DOM reordering.
   */
  setLeaderboard(you: number, cpu: number | null): void {
    if (you === this.lastLbYou && (cpu ?? -1) === this.lastLbCpu) return;
    this.lastLbYou = you;
    this.lastLbCpu = cpu ?? -1;

    this.lbScoreEl.textContent = String(you);
    if (cpu === null) {
      this.lbRowCpu.hidden = true;
      this.lbRowYou.querySelector('[data-rank]')!.textContent = '1';
      return;
    }
    this.lbRowCpu.hidden = false;
    this.lbScoreCpuEl.textContent = String(cpu);

    // sort desc; ties keep You ahead. Reorder rows + renumber ranks.
    const youAhead = you >= cpu;
    const first = youAhead ? this.lbRowYou : this.lbRowCpu;
    const second = youAhead ? this.lbRowCpu : this.lbRowYou;
    if (this.lbRowsEl.firstElementChild !== first) {
      this.lbRowsEl.appendChild(first);
      this.lbRowsEl.appendChild(second);
    }
    first.querySelector('[data-rank]')!.textContent = '1';
    second.querySelector('[data-rank]')!.textContent = '2';
  }

  /**
   * Render the stem with KaTeX, synchronously, into the stable content node.
   * The pop animation is a class on the PANEL wrapper — it never clears or
   * replaces the content node, so the equation survives every round.
   */
  setProblem(latex: string, values: number[]): void {
    if (!latex || latex.trim() === '') return; // never blank the stem on a bad push
    if (!this.stemEl.isConnected) {
      // belt-and-braces: a push aimed at a dead root must not get lost silently
      console.warn('HUD stem received a problem while detached:', latex);
      return;
    }
    katex.render(`${latex} \\;=\\; ?`, this.stemEl, { throwOnError: false });
    retrigger(this.stemPanel, 'stem-pop');
    for (let i = 0; i < this.choiceEls.length; i++) {
      this.choiceEls[i].textContent = values[i] !== undefined ? String(values[i]) : '';
    }
  }

  setScore(score: number): void {
    if (score === this.lastScore) return;
    const grew = score > this.lastScore && this.lastScore >= 0;
    this.lastScore = score;
    this.scoreEl.textContent = String(score);
    this.lbScoreEl.textContent = String(score);
    if (grew) retrigger(this.scoreEl, 'score-pop');
  }

  setStreak(streak: number): void {
    if (streak === this.lastStreak) return;
    const grew = streak > this.lastStreak && this.lastStreak >= 0;
    this.lastStreak = streak;
    this.streakEl.textContent = String(streak);
    if (grew) retrigger(this.streakEl, 'flare');
  }

  setLength(length: number): void {
    if (length === this.lastLength) return;
    this.lastLength = length;
    this.lengthEl.textContent = String(length);
    const fill = Math.min(length, LENGTH_CELLS);
    if (fill !== this.lastFill) {
      this.lastFill = fill;
      for (let i = 0; i < LENGTH_CELLS; i++) {
        this.lengthCells[i].classList.toggle('fill', i < fill);
      }
    }
  }

  /** Seconds text updates once per second; the ring sweeps continuously. */
  setTimer(secondsLeft: number, fraction: number, urgent: boolean): void {
    this.ringFg.style.strokeDashoffset = String(
      RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)))
    );
    const t = Math.ceil(secondsLeft);
    if (t === this.lastTimerSec) return;
    this.lastTimerSec = t;
    this.timerEl.textContent = String(t);
    this.timerPanel.classList.toggle('urgent', urgent);
  }

  /** Brief red flash on the stem panel (the relevant HUD region, per the brief). */
  flashWrong(): void {
    retrigger(this.stemPanel, 'wrong');
  }
}
