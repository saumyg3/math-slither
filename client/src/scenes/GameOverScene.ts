// DOM results screen per the design brief: win/lose variants, score / accuracy /
// best streak, a short K-12-friendly summary, Play again + Back to title.

import Phaser from 'phaser';
import { WIN_SCORE } from '../game';
import { el } from '../hud/dom';
import { mountScreen } from '../hud/overlay';
import { injectStyles } from '../hud/styles';

interface Results {
  won: boolean;
  score: number;
  rivalScore: number;
  bestStreak: number;
  answered: number;
  correctCount: number;
  best: number;
  newBest: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private results: Results = {
    won: false,
    score: 0,
    rivalScore: 0,
    bestStreak: 0,
    answered: 0,
    correctCount: 0,
    best: 0,
    newBest: false,
  };

  constructor() {
    super('GameOver');
  }

  init(data: Partial<Results>): void {
    this.results = {
      won: data.won ?? false,
      score: data.score ?? 0,
      rivalScore: data.rivalScore ?? 0,
      bestStreak: data.bestStreak ?? 0,
      answered: data.answered ?? 0,
      correctCount: data.correctCount ?? 0,
      best: data.best ?? 0,
      newBest: data.newBest ?? false,
    };
  }

  create(): void {
    injectStyles();
    const r = this.results;
    const accuracy = r.answered > 0 ? Math.round((r.correctCount / r.answered) * 100) : 0;

    this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'water-bg')
      .setOrigin(0)
      .setScrollFactor(0);

    const verdict = r.won ? 'YOU WIN!' : 'CPU WINS';
    const root = el(/* html */ `
<div class="results-screen" data-testid="results-screen">
  <div class="results-panel panel">
    <div class="results-verdict ${r.won ? 'win' : 'lose'}" data-testid="results-verdict">
      ${verdict}
    </div>
    <p class="results-summary" data-testid="results-summary">${summaryLine(r, accuracy)}</p>
    <div class="results-matchup" data-testid="results-matchup">
      <span class="mu-you">You ${r.score}</span>
      <span class="mu-vs">vs</span>
      <span class="mu-cpu">CPU ${r.rivalScore}</span>
    </div>
    <div class="results-best-pill" data-testid="results-best">
      <span class="best-dot"></span> Best: <span class="best-value">${r.best}</span>
      ${r.newBest ? '<span class="new-best-tag">New best!</span>' : ''}
    </div>
    <div class="results-stats">
      <div class="stat">
        <span class="stat-value" data-testid="results-score">${r.score}</span>
        <span class="hud-label">Score</span>
      </div>
      <div class="stat">
        <span class="stat-value" data-testid="results-best-streak">&times;${r.bestStreak}</span>
        <span class="hud-label">Best streak</span>
      </div>
      <div class="stat">
        <span class="stat-value" data-testid="results-accuracy">${accuracy}%</span>
        <span class="hud-label">Accuracy</span>
      </div>
    </div>
    <div class="results-actions">
      <button class="play-button" data-testid="play-again-button">PLAY AGAIN</button>
      <button class="ghost-button" data-testid="back-to-title-button">Back to title</button>
    </div>
  </div>
</div>
`);
    mountScreen(this, root);

    (root.querySelector('[data-testid="play-again-button"]') as HTMLButtonElement).addEventListener(
      'click',
      () => this.scene.start('Play', { seed: (Date.now() & 0xffffffff) >>> 0 })
    );
    (
      root.querySelector('[data-testid="back-to-title-button"]') as HTMLButtonElement
    ).addEventListener('click', () => this.scene.start('Title'));
  }
}

function summaryLine(r: Results, accuracy: number): string {
  if (r.won) {
    if (r.score >= WIN_SCORE) return `You raced to ${WIN_SCORE} and beat the CPU &mdash; brilliant slithering!`;
    return 'You finished ahead of the CPU when the clock ran out. Nice race!';
  }
  if (r.rivalScore >= WIN_SCORE) return 'The CPU reached the target first &mdash; so close! Another run?';
  if (accuracy >= 50) return 'The CPU edged ahead &mdash; watch for those tricky near-miss orbs.';
  return 'Every orb you chase makes you faster. Rematch the CPU?';
}
