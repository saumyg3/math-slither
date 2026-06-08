// DOM title screen matched to the Claude Design reference: brand tag, Best
// pill, gradient stacked title, glowing Play, segmented mode selector (Versus /
// Practice as a disabled roadmap), and a Math Pack + Difficulty control bar.
// Pack and difficulty selections are real: they feed the sim via the registry.

import Phaser from 'phaser';
import { audio } from '../audio';
import { el } from '../hud/dom';
import { mountScreen } from '../hud/overlay';
import { injectStyles } from '../hud/styles';
import { loadBest } from '../storage';

export type PackId = 'multiply' | 'addsub';
export type DifficultyId = 'gentle' | 'standard' | 'stormy';

export const PACK_LABELS: Record<PackId, string> = { multiply: 'Multiply', addsub: 'Add/Sub' };
export const DIFFICULTY_LABELS: Record<DifficultyId, string> = {
  gentle: 'Gentle',
  standard: 'Standard',
  stormy: 'Stormy',
};

// drifting background orbs: value, color pair, position, size, drift duration
const BG_ORBS: Array<[number, string, string, string, string, number, number]> = [
  [4, '#7de8db', '#2da89c', '14%', '38%', 96, 7],
  [16, '#b9c7c9', '#7e8f93', '24%', '74%', 84, 9],
  [10, '#d6ff7e', '#86c92e', '47%', '80%', 78, 8],
  [13, '#ffd089', '#e89b2e', '78%', '64%', 92, 6.5],
  [7, '#ff9ec9', '#e0428f', '84%', '24%', 72, 7.5],
];

const TITLE_HTML = /* html */ `
<div class="title-screen" data-testid="title-screen">
  <div class="current-band" style="top:-6%"></div>
  <div class="current-band" style="top:34%"></div>
  <div class="current-band" style="top:72%"></div>

  <div class="brand-tag reveal" style="animation-delay:0s">
    <span class="brand-dot"></span> Bioluminescent math arcade
  </div>
  <div class="best-pill glass reveal" style="animation-delay:0.05s" data-testid="best-pill">
    <span class="best-dot"></span> Best <span class="best-value" data-testid="best-score">0</span>
  </div>

  <div class="title-stack">
    <h1 class="game-title reveal" style="animation-delay:0.08s">
      <span class="game-title-math">MATH</span>
      <span class="game-title-slither">SLITHER</span>
    </h1>
    <p class="title-sub reveal" style="animation-delay:0.16s">
      Steer the glowing eel into the orb that solves the problem. Eat the right
      answer to grow, glow, and climb the score.
    </p>
    <button class="play-button reveal" style="animation-delay:0.24s" data-testid="play-button">&#9656; Play</button>
    <div class="choose-label reveal" style="animation-delay:0.3s">Choose a mode</div>
    <div class="mode-selector glass reveal" style="animation-delay:0.34s" data-testid="mode-selector" role="radiogroup" aria-label="Game mode">
      <button class="mode-seg active" data-testid="mode-solo" aria-pressed="true">
        <span class="mode-name">Solo</span>
        <span class="mode-desc">You vs. the clock</span>
      </button>
      <button class="mode-seg" data-testid="mode-versus" disabled aria-disabled="true" title="Coming soon">
        <span class="mode-name">Versus <span class="soon-tag">soon</span></span>
        <span class="mode-desc">2&ndash;4 player race</span>
      </button>
      <button class="mode-seg" data-testid="mode-practice" disabled aria-disabled="true" title="Coming soon">
        <span class="mode-name">Practice <span class="soon-tag">soon</span></span>
        <span class="mode-desc">No timer &middot; diagnostic</span>
      </button>
    </div>
  </div>

  <div class="control-bar glass reveal" style="animation-delay:0.42s" data-testid="control-bar">
    <span class="hud-label">Math pack</span>
    <button class="chip-btn" data-pack="multiply" data-testid="pack-multiply"><span class="chip-sym">&times;</span>Multiply</button>
    <button class="chip-btn" data-pack="addsub" data-testid="pack-addsub"><span class="chip-sym">+&minus;</span>Add/Sub</button>
    <button class="chip-btn" disabled title="Coming soon" data-testid="pack-divide"><span class="chip-sym">&divide;</span>Divide</button>
    <button class="chip-btn" disabled title="Coming soon" data-testid="pack-fractions"><span class="chip-sym">&frac12;</span>Fractions</button>
    <button class="chip-btn" disabled title="Coming soon" data-testid="pack-integers"><span class="chip-sym">&plusmn;</span>Integers</button>
    <button class="chip-btn" disabled title="Coming soon" data-testid="pack-order"><span class="chip-sym">( )</span>Order</button>
    <span class="bar-divider"></span>
    <span class="hud-label">Difficulty</span>
    <button class="chip-btn" data-difficulty="gentle" data-testid="difficulty-gentle">Gentle</button>
    <button class="chip-btn" data-difficulty="standard" data-testid="difficulty-standard">Standard</button>
    <button class="chip-btn" data-difficulty="stormy" data-testid="difficulty-stormy">Stormy</button>
  </div>
</div>
`;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    injectStyles();

    // dark-water mood behind the DOM chrome
    this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'water-bg')
      .setOrigin(0)
      .setScrollFactor(0);

    const root = el(TITLE_HTML);
    this.addBgOrbs(root);
    mountScreen(this, root);

    const play = root.querySelector('[data-testid="play-button"]') as HTMLButtonElement;
    play.addEventListener('click', () => {
      audio.unlock(); // first definite gesture — lift the autoplay suspension here
      this.scene.start('Play', { seed: (Date.now() & 0xffffffff) >>> 0 });
    });

    // Solo is the active (and only enabled) mode.
    const solo = root.querySelector('[data-testid="mode-solo"]') as HTMLButtonElement;
    solo.addEventListener('click', () => solo.classList.add('active'));
    this.registry.set('mode', 'solo');

    this.wireChipGroup(root, 'pack', (this.registry.get('pack') as string) ?? 'multiply');
    this.wireChipGroup(
      root,
      'difficulty',
      (this.registry.get('difficulty') as string) ?? 'standard'
    );

    // Best score — persisted high-water mark from localStorage.
    const best = root.querySelector('[data-testid="best-score"]') as HTMLElement;
    best.textContent = String(loadBest());
  }

  /** One-active-chip group; the selection is stored in the registry for the sim. */
  private wireChipGroup(root: HTMLElement, key: 'pack' | 'difficulty', initial: string): void {
    const chips = Array.from(root.querySelectorAll<HTMLButtonElement>(`[data-${key}]`));
    const select = (value: string): void => {
      this.registry.set(key, value);
      for (const c of chips) c.classList.toggle('active', c.dataset[key] === value);
    };
    select(initial);
    for (const c of chips) {
      c.addEventListener('click', () => select(c.dataset[key]!));
    }
  }

  private addBgOrbs(root: HTMLElement): void {
    for (const [value, hi, lo, left, top, size, dur] of BG_ORBS) {
      const orb = el(
        `<div class="bg-orb" style="left:${left};top:${top};width:${size}px;height:${size}px;` +
          `font-size:${Math.round(size * 0.34)}px;--dur:${dur}s;` +
          `background:radial-gradient(circle at 32% 28%, ${hi}, ${lo} 78%);` +
          `box-shadow:0 0 ${Math.round(size * 0.5)}px ${lo}66;">${value}</div>`
      );
      root.insertBefore(orb, root.querySelector('.brand-tag'));
    }
  }
}
