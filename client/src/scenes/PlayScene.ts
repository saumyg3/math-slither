// Renders the pure sim and feeds it input. All gameplay rules live in game.ts;
// all answer-checking lives in grade.ts (called by the sim). This scene only
// draws, tweens, and reads the pointer/keys. Readouts live in the DOM HudScene
// (launched alongside); canvas keeps the minimap, countdown, and feedback FX.

import Phaser from 'phaser';
import { audio } from '../audio';
import { ARENA, MATCH_SECONDS, Sim, TUNING, URGENT_SECONDS, type SimEvent, type SimOptions } from '../game';
import { el } from '../hud/dom';
import { loadBest, saveBest } from '../storage';
import { mountScreen } from '../hud/overlay';
import type { Topic } from '../problems';
import type { HudScene } from './HudScene';
import { DIFFICULTY_LABELS, PACK_LABELS, type DifficultyId, type PackId } from './TitleScene';

// math-pack → topic pool; difficulty → tier window (standard = the original tuning)
const PACK_TOPICS: Record<PackId, readonly Topic[]> = {
  multiply: ['mul'],
  addsub: ['add', 'sub'],
};
const DIFFICULTY_TIERS: Record<DifficultyId, Pick<SimOptions, 'startTier' | 'maxTier'>> = {
  gentle: { startTier: 1, maxTier: 2 },
  standard: { startTier: 1, maxTier: 4 },
  stormy: { startTier: 2, maxTier: 4 },
};

const PLAYER_TINT = 0x3fe0d0; // cyan, player 1 (art bible)
const RIVAL_TINT = 0xff4fa3; // pink, player 2 — the CPU rival reads as a separate racer

// camera zoom: scale with window so the eel/orbs stay a comfortable size on wide
// windows (zoom 1 ≈ the 1280×720 design view) instead of shrinking.
const REF_VIEW = { width: 1280, height: 720 };
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.4;
// world is a generous multiple of the visible area so there's room to slither.
const WORLD_FACTOR = 1.6;

// minimap (top-right, fixed to camera; center-top stays free for the stem)
const MAP_W = 152;
const MAP_MARGIN = 24;
const MAP_TOP = 96; // below the ring-timer panel

interface OrbView {
  id: number;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

export class PlayScene extends Phaser.Scene {
  private sim!: Sim;
  private seed = 1;

  private headSprite!: Phaser.GameObjects.Image;
  private segmentSprites: Phaser.GameObjects.Image[] = [];
  private orbViews: OrbView[] = [];

  // CPU rival eel (pink); rendered just under the player so it never obscures you
  private rivalHeadSprite: Phaser.GameObjects.Image | null = null;
  private rivalSegmentSprites: Phaser.GameObjects.Image[] = [];
  private rivalDot: Phaser.GameObjects.Image | null = null;

  private flashRect!: Phaser.GameObjects.Rectangle;
  private hud: HudScene | null = null;
  private modeText = 'Solo';
  private mapH = 114; // minimap height, set from the world aspect in createMinimap

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private crashed = false;

  // keys set a PERSISTENT heading (classic snake); the pointer takes over only when it moves
  private controlMode: 'pointer' | 'keys' = 'pointer';
  private firstTick = true;

  // pause menu: while paused the sim is not stepped (timer + motion frozen),
  // scene tweens and countdown timers are held, and the overlay blocks input
  private paused = false;
  private pauseOverlayEl!: HTMLElement;

  // start-of-match countdown: sim is NOT stepped while 'ready', so the match
  // timer, scoring, and the spawn rev-up ramp all hold until "Go"
  private phase: 'ready' | 'live' = 'ready';
  private countdownText!: Phaser.GameObjects.Text;
  private countdownTimers: Phaser.Time.TimerEvent[] = [];
  private bobTween: Phaser.Tweens.Tween | null = null;
  private goFlashRect!: Phaser.GameObjects.Rectangle;
  private readyPointerX = 0;
  private readyPointerY = 0;
  private keyHeading = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private tmpVec = new Phaser.Math.Vector2(); // reused — no per-frame allocation

  private minimap!: Phaser.GameObjects.Container;
  private minimapEelDot!: Phaser.GameObjects.Image;
  private minimapOrbDots: Phaser.GameObjects.Image[] = [];

  // tail-fade alphas only depend on segment count — recompute on change only
  private lastSegCount = -1;

  constructor() {
    super('Play');
  }

  init(data: { seed?: number }): void {
    this.seed = data.seed ?? 1;
  }

  create(): void {
    this.crashed = false;
    const pack = ((this.registry.get('pack') as PackId) ?? 'multiply') as PackId;
    const difficulty = ((this.registry.get('difficulty') as DifficultyId) ??
      'standard') as DifficultyId;
    this.modeText = `Solo · ${PACK_LABELS[pack]} · ${DIFFICULTY_LABELS[difficulty]}`;

    // Size the world to the live viewport: the arena is a generous multiple of
    // the visible area (which depends on the zoom), with the default ARENA as a
    // floor so a small window still gets a roomy arena.
    const zoom = this.computeZoom();
    const viewW = this.scale.width / zoom;
    const viewH = this.scale.height / zoom;
    const world = {
      width: Math.max(ARENA.width, Math.round(viewW * WORLD_FACTOR)),
      height: Math.max(ARENA.height, Math.round(viewH * WORLD_FACTOR)),
    };

    this.sim = new Sim(this.seed, {
      topics: PACK_TOPICS[pack],
      ...DIFFICULTY_TIERS[difficulty],
      world,
      rival: true, // M3: local CPU rival
    });
    this.controlMode = 'pointer';
    this.firstTick = true;
    this.lastSegCount = -1;
    this.minimapOrbDots = [];
    this.rivalHeadSprite = null;
    this.rivalSegmentSprites = [];
    this.rivalDot = null;
    if (import.meta.env.DEV) {
      // dev-only hook for automated smoke tests
      (window as unknown as Record<string, unknown>).__sim = this.sim;
      (window as unknown as Record<string, unknown>).__cam = this.cameras.main;
      (window as unknown as Record<string, unknown>).__tuning = TUNING; // dial live: __tuning.baseSpeed = 420
    }
    this.segmentSprites = [];
    this.orbViews = [];

    // --- world (sized to the sim's arena bounds for this match)
    this.add.tileSprite(0, 0, world.width, world.height, 'water-bg').setOrigin(0);
    this.drawCurrentBands();
    const border = this.add.graphics();
    border.lineStyle(4, 0x3fe0d0, 0.5);
    border.strokeRect(2, 2, world.width - 4, world.height - 4);

    // --- minimap (before the eel/orbs — their sync methods update its markers)
    this.createMinimap();

    // --- rival eel (created before the player so the player renders on top)
    if (this.sim.state.rival) {
      this.rivalHeadSprite = this.add
        .image(0, 0, 'eel-head')
        .setTint(RIVAL_TINT)
        .setAlpha(0.92)
        .setDepth(8);
    }

    // --- eel
    this.headSprite = this.add.image(0, 0, 'eel-head').setTint(PLAYER_TINT).setDepth(10);
    this.syncEel();
    this.syncRival();

    // --- orbs for the first problem
    this.syncOrbs();

    // --- camera (tight follow — a loose lerp reads as input lag)
    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.startFollow(this.headSprite, true, 0.25, 0.25);
    // snap onto the head NOW — no first-frames settle drift at match start
    this.cameras.main.centerOn(this.sim.state.head.x, this.sim.state.head.y);
    this.layoutMinimap(); // pin to corner now that the zoom is known

    // Oversized + centered so it covers the screen at ANY camera zoom (a
    // screen-sized scrollFactor-0 rect under-covers the edges when zoom < 1).
    this.flashRect = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, 8000, 8000, 0xff4fa3, 0)
      .setScrollFactor(0)
      .setDepth(90);

    // --- keep the camera zoom and screen-fixed UI matched to the live window
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this)
    );

    // --- DOM HUD (separate scene; stem via KaTeX, data-testids preserved)
    // ALWAYS bind via the hud-ready event of THIS launch. Checking a ready
    // flag races scene-queue ordering on restart (the queued stop('Hud') has
    // not processed yet, so a stale flag binds to the about-to-die DOM root —
    // that was the intermittent empty-stem bug).
    this.hud = null;
    const hud = this.scene.get('Hud') as HudScene;
    const onHudReady = (): void => this.bindHud(hud);
    hud.events.once('hud-ready', onHudReady);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      hud.events.off('hud-ready', onHudReady);
      this.scene.stop('Hud');
      audio.stopAmbient();
    });
    this.scene.launch('Hud');
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__audio = audio;
    }

    // --- input
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // --- pause control + overlay
    this.createPauseUi();

    // --- get-ready countdown (problem + orbs already visible behind it)
    this.startCountdown();
  }

  // ----- viewport / resize ----------------------------------------------------------

  /** Zoom so the eel/orbs stay a comfortable size — ≈1 at the 1280×720 design. */
  private computeZoom(): number {
    const z = Math.max(this.scale.width / REF_VIEW.width, this.scale.height / REF_VIEW.height);
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  /** Window changed: re-zoom the camera and re-anchor the screen-fixed canvas UI. */
  private onResize(): void {
    if (!this.cameras?.main) return;
    this.cameras.main.setZoom(this.computeZoom());
    this.layoutFixed();
  }

  /** Re-anchor the scroll-fixed canvas elements to the live viewport. */
  private layoutFixed(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // flashes are oversized (8000²) — only need re-centering on the camera
    if (this.flashRect) this.flashRect.setPosition(w / 2, h / 2);
    if (this.goFlashRect) this.goFlashRect.setPosition(w / 2, h / 2);
    if (this.countdownText) this.countdownText.setPosition(w / 2, h / 2);
    this.layoutMinimap();
  }

  /**
   * Pin the minimap flush to the top-right corner at constant pixel size. A
   * scrollFactor(0) object is still transformed by camera zoom (renders at
   * center + (pos-center)*zoom), which pushed the box off-screen once zoom != 1.
   * Counter it: scale by 1/zoom and place so the box lands exactly at the corner.
   */
  private layoutMinimap(): void {
    if (!this.minimap) return;
    const z = this.cameras.main.zoom;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const dx = this.scale.width - MAP_MARGIN - MAP_W; // desired screen top-left
    const dy = MAP_TOP;
    this.minimap.setScale(1 / z);
    this.minimap.setPosition(cx + (dx - cx) / z, cy + (dy - cy) / z);
  }

  // ----- pause menu ----------------------------------------------------------------

  private createPauseUi(): void {
    this.paused = false;
    const root = el(/* html */ `
<div class="pause-root">
  <button class="pause-btn" data-testid="pause-button" title="Pause (Esc)">
    <svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
  </button>
  <div class="pause-overlay" data-testid="pause-overlay">
    <div class="pause-panel glass">
      <div class="pause-title">Paused</div>
      <button class="play-button" data-testid="resume-button">Resume</button>
      <div class="pause-actions">
        <button class="ghost-button" data-testid="restart-button">Restart</button>
        <button class="ghost-button" data-testid="quit-button">Quit to title</button>
      </div>
    </div>
  </div>
</div>
`);
    mountScreen(this, root);
    this.pauseOverlayEl = root.querySelector('[data-testid="pause-overlay"]') as HTMLElement;

    const on = (testid: string, fn: () => void): void => {
      (root.querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement).addEventListener(
        'click',
        fn
      );
    };
    on('pause-button', () => this.openPause());
    on('resume-button', () => this.closePause());
    on('restart-button', () =>
      this.scene.start('Play', { seed: (Date.now() & 0xffffffff) >>> 0 })
    );
    on('quit-button', () => this.scene.start('Title'));

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.paused) this.closePause();
      else this.openPause();
    });

    // Spacebar also toggles pause, but ONLY during active play — during the
    // 3-2-1 countdown (phase 'ready') space still skips, as before.
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.phase !== 'live') return;
      if (this.paused) this.closePause();
      else this.openPause();
    });
  }

  private openPause(): void {
    if (this.paused || this.sim.state.status !== 'playing') return;
    this.paused = true;
    this.pauseOverlayEl.classList.add('open');
    this.tweens.pauseAll(); // orb bob, pops, countdown text — everything holds
    for (const t of this.countdownTimers) t.paused = true;
  }

  private closePause(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseOverlayEl.classList.remove('open');
    this.tweens.resumeAll();
    for (const t of this.countdownTimers) t.paused = false;
    // re-anchor the countdown's move-to-skip — the pointer moved to click Resume
    this.readyPointerX = this.input.activePointer.x;
    this.readyPointerY = this.input.activePointer.y;
  }

  // ----- countdown ----------------------------------------------------------------

  private startCountdown(): void {
    this.phase = 'ready';
    this.countdownTimers = [];

    this.goFlashRect = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, 8000, 8000, 0x3fe0d0, 0)
      .setScrollFactor(0)
      .setDepth(105);

    this.countdownText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'Unbounded, sans-serif',
        fontSize: '110px',
        fontStyle: 'bold',
        color: '#3FE0D0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(110)
      .setShadow(0, 0, '#3FE0D0', 24, true, true);

    // hold the eel gently bobbing at its spawn point (visual only — sim is paused)
    this.bobTween = this.tweens.add({
      targets: [this.headSprite, ...this.segmentSprites],
      y: '+=5',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // brisk 3-2-1 (450ms each), then Go — ~1.35s to player control
    const steps: Array<{ txt: string; color: string }> = [
      { txt: '3', color: '#3FE0D0' },
      { txt: '2', color: '#FF4FA3' },
      { txt: '1', color: '#B6FF3C' },
    ];
    this.showCount(steps[0]);
    this.countdownTimers.push(
      this.time.delayedCall(450, () => this.showCount(steps[1])),
      this.time.delayedCall(900, () => this.showCount(steps[2])),
      this.time.delayedCall(1350, () => this.go())
    );

    // skippable: a new click or key press jumps straight to Go; pointer
    // movement is checked per-frame in tick() against this anchor
    this.readyPointerX = this.input.activePointer.x;
    this.readyPointerY = this.input.activePointer.y;
    this.input.on('pointerdown', this.skipCountdown, this);
    this.input.keyboard!.on('keydown', this.skipCountdown, this);
  }

  /** Esc opens the pause menu — it must not double as a countdown skip. */
  private isSkipExempt(ev?: unknown): boolean {
    return (
      this.paused ||
      (ev instanceof KeyboardEvent && ev.key === 'Escape')
    );
  }

  private showCount(step: { txt: string; color: string }): void {
    this.countdownText
      .setText(step.txt)
      .setColor(step.color)
      .setShadow(0, 0, step.color, 24, true, true)
      .setAlpha(1)
      .setScale(1.7);
    this.tweens.add({ targets: this.countdownText, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private skipCountdown(ev?: unknown): void {
    if (this.isSkipExempt(ev)) return;
    if (this.phase === 'ready') this.go();
  }

  /** Hand control to the player; the sim's own spawn ramp revs the eel up. */
  private go(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'live';

    for (const t of this.countdownTimers) t.remove(false);
    this.countdownTimers = [];
    this.input.off('pointerdown', this.skipCountdown, this);
    this.input.keyboard!.off('keydown', this.skipCountdown, this);
    if (this.bobTween) {
      this.bobTween.stop();
      this.bobTween = null;
    }

    // punchy GO: amber pop + cyan bloom flash
    this.countdownText
      .setText('GO!')
      .setColor('#FFB23E')
      .setShadow(0, 0, '#FFB23E', 28, true, true)
      .setAlpha(1)
      .setScale(0.9);
    this.tweens.add({
      targets: this.countdownText,
      scale: 2.0,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => this.countdownText.setVisible(false),
    });
    this.goFlashRect.setAlpha(0.22);
    this.tweens.add({ targets: this.goFlashRect, alpha: 0, duration: 280 });

    audio.startAmbient(); // quiet underwater pad for the match
  }

  update(_time: number, deltaMs: number): void {
    // A throw inside update() freezes the whole render loop — guard it.
    if (this.crashed) return;
    try {
      this.tick(Math.min(deltaMs, 100) / 1000);
    } catch (err) {
      this.crashed = true;
      console.error('PlayScene update crashed:', err);
    }
  }

  private tick(dt: number): void {
    if (this.paused) return; // frozen: no sim step, no countdown skip, no readouts
    if (this.phase === 'ready') {
      // sim is paused (timer, scoring, ramp all hold); pointer movement skips
      const moved = Math.hypot(
        this.input.activePointer.x - this.readyPointerX,
        this.input.activePointer.y - this.readyPointerY
      );
      if (moved > 14) this.go();
      return;
    }
    if (this.firstTick) {
      // the first delta after a scene switch includes create() time — a big dt
      // here teleports the head, which the camera then visibly chases
      this.firstTick = false;
      dt = Math.min(dt, 1 / 60);
    }
    const events = this.sim.step(dt, { heading: this.readHeading() });
    for (const ev of events) this.handleEvent(ev);

    this.syncEel();
    this.syncRival();
    this.syncOrbPositions();
    this.refreshReadouts();
    this.layoutMinimap(); // track the live zoom (incl. the correct-answer punch)
  }

  // ----- input ------------------------------------------------------------------

  /**
   * Keys set a PERSISTENT heading: press once and the eel keeps that direction
   * after release (classic snake / .io), until another key or pointer movement
   * changes it. Pointer movement hands control back to the pointer.
   */
  private readHeading(): number | null {
    const pointer = this.input.activePointer;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.controlMode = 'keys';
      this.keyHeading = Math.atan2(dy, dx);
      // remember where the pointer was so only real movement reclaims control
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      return this.keyHeading;
    }

    if (this.controlMode === 'keys') {
      const moved = Math.hypot(pointer.x - this.lastPointerX, pointer.y - this.lastPointerY);
      if (moved < 14) return this.keyHeading; // keys still own the heading
      this.controlMode = 'pointer';
    }

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.tmpVec);
    const head = this.sim.state.head;
    const dist = Math.hypot(world.x - head.x, world.y - head.y);
    if (dist < 12) return null; // dead zone: pointer on the head = hold course
    return Math.atan2(world.y - head.y, world.x - head.x);
  }

  // ----- events -----------------------------------------------------------------

  private handleEvent(ev: SimEvent): void {
    switch (ev.type) {
      case 'correct': {
        // juice escalates with the streak (visuals only — scoring untouched)
        this.popAt(ev.x, ev.y, ev.streak);
        this.flareEel(ev.streak);
        this.punchCamera(ev.streak);
        audio.play('sfx-correct', ev.streak);
        break;
      }
      case 'wrong': {
        this.cameras.main.shake(160, 0.006);
        this.flashRect.setAlpha(0.28);
        this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 280 });
        this.hud?.flashWrong();
        audio.play('sfx-wrong');
        break;
      }
      case 'problem': {
        this.syncOrbs();
        this.pushProblem();
        break;
      }
      case 'tier':
        break; // surfaced in the HUD at M1
      case 'rival': {
        // subtle pink pop where the CPU answered — distinct, not chaotic
        if (ev.correct) this.rivalPopAt(ev.x, ev.y);
        break;
      }
      case 'over': {
        const s = this.sim.state;
        const newBest = ev.score > loadBest();
        const best = saveBest(ev.score);
        audio.stopAmbient();
        this.time.delayedCall(500, () => {
          this.scene.start('GameOver', {
            won: ev.won,
            score: ev.score,
            rivalScore: ev.rivalScore,
            bestStreak: s.bestStreak,
            answered: s.answered,
            correctCount: s.correctCount,
            best,
            newBest,
          });
        });
        break;
      }
    }
  }

  /** Small, subdued pink bloom when the rival scores — readable, not loud. */
  private rivalPopAt(x: number, y: number): void {
    const pop = this.add.image(x, y, 'orb').setTint(RIVAL_TINT).setAlpha(0.7).setDepth(19);
    this.tweens.add({
      targets: pop,
      scale: 1.6,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });
  }

  /** Orb bloom — bigger pop, more sparks, wider burst as the streak climbs. */
  private popAt(x: number, y: number, streak = 0): void {
    const k = Math.min(streak, 10);
    const pop = this.add.image(x, y, 'orb').setDepth(20);
    this.tweens.add({
      targets: pop,
      scale: 2.0 + k * 0.12,
      alpha: 0,
      duration: 260 + k * 10,
      ease: 'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });
    const sparks = 8 + k;
    const reach = 70 + k * 8;
    for (let i = 0; i < sparks; i++) {
      const ang = (i / sparks) * Math.PI * 2;
      const spark = this.add.image(x, y, 'spark').setDepth(20);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(ang) * reach,
        y: y + Math.sin(ang) * reach,
        alpha: 0,
        scale: 0.4,
        duration: 340 + k * 12,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** A white pulse travels head → tail; faster and brighter on hot streaks. */
  private flareEel(streak: number): void {
    const step = Math.max(10, 24 - streak * 2); // ms between segments
    const flash = (sprite: Phaser.GameObjects.Image | undefined): void => {
      if (!sprite || !sprite.active) return;
      sprite.setTint(0xffffff);
      this.tweens.add({ targets: sprite, scale: { from: 1.22, to: 1 }, duration: 150 });
      this.time.delayedCall(130, () => {
        if (sprite.active) sprite.setTint(PLAYER_TINT);
      });
    };
    flash(this.headSprite);
    for (let i = 0; i < this.segmentSprites.length; i++) {
      this.time.delayedCall(40 + i * step, () => flash(this.segmentSprites[i]));
    }
  }

  /** Small screen punch on correct — relative to the live base zoom. */
  private punchCamera(streak: number): void {
    const cam = this.cameras.main;
    const base = this.computeZoom();
    this.tweens.killTweensOf(cam);
    cam.setZoom(base);
    this.tweens.add({
      targets: cam,
      zoom: base * (1 + Math.min(0.014 + streak * 0.002, 0.036)),
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => cam.setZoom(base),
    });
  }

  // ----- sync sim -> sprites ------------------------------------------------------

  private syncEel(): void {
    const s = this.sim.state;
    this.headSprite.setPosition(s.head.x, s.head.y).setRotation(s.heading);

    while (this.segmentSprites.length < s.segments.length) {
      this.segmentSprites.push(
        this.add.image(s.head.x, s.head.y, 'eel-segment').setTint(PLAYER_TINT).setDepth(9)
      );
    }
    while (this.segmentSprites.length > s.segments.length) {
      this.segmentSprites.pop()!.destroy();
    }

    // tail-fade alphas only depend on segment count — recompute on change, not per frame
    if (this.lastSegCount !== s.segments.length) {
      this.lastSegCount = s.segments.length;
      for (let i = 0; i < this.segmentSprites.length; i++) {
        this.segmentSprites[i].setAlpha(1 - (i / Math.max(s.segments.length, 1)) * 0.4);
      }
    }

    for (let i = 0; i < s.segments.length; i++) {
      this.segmentSprites[i].setPosition(s.segments[i].x, s.segments[i].y);
    }

    // minimap eel marker (positions are cheap; no redraw involved)
    this.minimapEelDot.setPosition(
      (s.head.x / s.world.width) * MAP_W,
      (s.head.y / s.world.height) * this.mapH
    );
  }

  /** Mirror the sim's CPU rival to its pink eel sprites + minimap dot. */
  private syncRival(): void {
    const r = this.sim.state.rival;
    if (!r || !this.rivalHeadSprite) return;
    this.rivalHeadSprite.setPosition(r.head.x, r.head.y).setRotation(r.heading);

    while (this.rivalSegmentSprites.length < r.segments.length) {
      this.rivalSegmentSprites.push(
        this.add.image(r.head.x, r.head.y, 'eel-segment').setTint(RIVAL_TINT).setAlpha(0.85).setDepth(7)
      );
    }
    while (this.rivalSegmentSprites.length > r.segments.length) {
      this.rivalSegmentSprites.pop()!.destroy();
    }
    for (let i = 0; i < r.segments.length; i++) {
      this.rivalSegmentSprites[i].setPosition(r.segments[i].x, r.segments[i].y);
    }

    const world = this.sim.state.world;
    if (this.rivalDot) {
      this.rivalDot.setPosition((r.head.x / world.width) * MAP_W, (r.head.y / world.height) * this.mapH);
    }
  }

  /** Rebuild orb sprites to match the sim's current orb set (new problem / orb eaten). */
  private syncOrbs(): void {
    const orbs = this.sim.state.orbs;
    const live = new Set(orbs.map((o) => o.id));

    this.orbViews = this.orbViews.filter((v) => {
      if (live.has(v.id)) return true;
      v.sprite.destroy();
      v.label.destroy();
      return false;
    });

    const existing = new Set(this.orbViews.map((v) => v.id));
    for (const orb of orbs) {
      if (existing.has(orb.id)) continue;
      const sprite = this.add.image(orb.x, orb.y, 'orb').setDepth(5);
      // The number is a Phaser Text in Lexend drawn over the orb — never baked art.
      const label = this.add
        .text(orb.x, orb.y, String(orb.value), {
          fontFamily: 'Lexend, sans-serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#04141C',
        })
        .setOrigin(0.5)
        .setDepth(6);
      // gentle idle bob
      this.tweens.add({
        targets: [sprite, label],
        y: `+=${6}`,
        duration: 1100 + (orb.id % 5) * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.orbViews.push({ id: orb.id, sprite, label });
    }

    this.updateMinimapOrbs();
  }

  private syncOrbPositions(): void {
    // sim orbs are static; the bob tween owns y. Detect eaten orbs each tick.
    if (this.orbViews.length !== this.sim.state.orbs.length) this.syncOrbs();
  }

  /** Subtle wavy current bands across the arena floor (reference background). */
  private drawCurrentBands(): void {
    const { width: ww, height: wh } = this.sim.state.world;
    const g = this.add.graphics();
    const bands: Array<{ y: number; amp: number; width: number; alpha: number }> = [
      { y: wh * 0.21, amp: 80, width: 110, alpha: 0.1 },
      { y: wh * 0.51, amp: 100, width: 150, alpha: 0.08 },
      { y: wh * 0.8, amp: 70, width: 100, alpha: 0.1 },
    ];
    for (const b of bands) {
      g.lineStyle(b.width, 0x0e4654, b.alpha);
      g.beginPath();
      for (let x = -120; x <= ww + 120; x += 48) {
        const y = b.y + Math.sin((x / ww) * Math.PI * 2 + b.y * 0.01) * b.amp;
        if (x === -120) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  // ----- minimap -------------------------------------------------------------------

  /** Small fixed minimap, top-right: full arena bounds, orb dots, eel marker. */
  private createMinimap(): void {
    const world = this.sim.state.world;
    this.mapH = Math.round((MAP_W * world.height) / world.width); // match world aspect
    const bg = this.add
      .rectangle(0, 0, MAP_W, this.mapH, 0x04141c, 0.55)
      .setOrigin(0)
      .setStrokeStyle(1.5, 0x3fe0d0, 0.35);
    this.minimapEelDot = this.add.image(0, 0, 'mini-dot').setTint(PLAYER_TINT);
    const children: Phaser.GameObjects.GameObject[] = [bg, this.minimapEelDot];
    if (this.sim.state.rival) {
      this.rivalDot = this.add.image(0, 0, 'mini-dot').setTint(RIVAL_TINT);
      children.push(this.rivalDot);
    }
    this.minimap = this.add
      .container(this.scale.width - MAP_MARGIN - MAP_W, MAP_TOP, children)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.9);
  }

  /** One pooled dot per live orb; runs only when the orb set changes. */
  private updateMinimapOrbs(): void {
    const orbs = this.sim.state.orbs;
    while (this.minimapOrbDots.length < orbs.length) {
      const dot = this.add.image(0, 0, 'mini-dot').setTint(0xfff6e6).setScale(0.6).setAlpha(0.85);
      this.minimap.add(dot);
      this.minimapOrbDots.push(dot);
    }
    while (this.minimapOrbDots.length > orbs.length) {
      this.minimapOrbDots.pop()!.destroy();
    }
    const world = this.sim.state.world;
    for (let i = 0; i < orbs.length; i++) {
      this.minimapOrbDots[i].setPosition(
        (orbs[i].x / world.width) * MAP_W,
        (orbs[i].y / world.height) * this.mapH
      );
    }
    this.minimap.bringToTop(this.minimapEelDot); // eel marker always above orb dots
    if (this.rivalDot) this.minimap.bringToTop(this.rivalDot);
  }

  // ----- HUD bridge ----------------------------------------------------------------

  /** Called once the HudScene's DOM exists; pushes the initial match state. */
  private bindHud(hud: HudScene): void {
    if (!this.scene.isActive()) return; // PlayScene already gone
    this.hud = hud;
    hud.setMode(this.modeText);
    this.pushProblem();
    this.refreshReadouts();
  }

  private pushProblem(): void {
    this.hud?.setProblem(
      this.sim.state.problem.latex,
      this.sim.state.orbs.map((o) => o.value)
    );
  }

  /** Push sim state into the DOM HUD (HudScene caches; DOM touched on change only). */
  private refreshReadouts(): void {
    if (!this.hud) return;
    const s = this.sim.state;
    this.hud.setScore(s.score);
    this.hud.setStreak(s.streak);
    this.hud.setLength(s.segments.length);
    this.hud.setTimer(s.timeLeft, s.timeLeft / MATCH_SECONDS, s.timeLeft <= URGENT_SECONDS);
    this.hud.setLeaderboard(s.score, s.rival ? s.rival.score : null);
  }
}
