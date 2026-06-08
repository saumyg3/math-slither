// Synthesized SFX via the Web Audio API — zero asset files. Keys mirror the
// SFX entries in assets-manifest.ts ('sfx-correct', 'sfx-wrong', 'sfx-ambient'),
// so swapping in the real Ludo files later means replacing the synth bodies
// with buffer playback behind this same interface.

type SfxKey = 'sfx-correct' | 'sfx-wrong';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private ambient: { gain: GainNode; stops: Array<() => void> } | null = null;
  private unlockInstalled = false;

  /**
   * Resume/unlock the context from within a real user gesture. The autoplay
   * policy only lifts when resume() runs inside a gesture handler (Play click,
   * keydown, pointerdown) — mousemove steering does NOT count, and the
   * countdown can auto-finish with no gesture at all, so without this the
   * context stays suspended forever and nothing is ever heard. Call this from
   * gesture handlers; installUnlockHandlers() wires the global ones.
   */
  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') void ctx.resume();
    // a one-sample silent blip helps some engines flip suspended -> running
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  /** Attach global gesture listeners that unlock audio; self-removes once running. */
  installUnlockHandlers(): void {
    if (this.unlockInstalled) return;
    this.unlockInstalled = true;
    const handler = (): void => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
      }
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
  }

  /** Lazy-create the context + master gain (connected to the destination). */
  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination); // master -> speakers
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Test accessor: 'none' before creation, else the live context state. */
  stateForTest(): string {
    return this.ctx ? this.ctx.state : 'none';
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  isAmbientOn(): boolean {
    return this.ambient !== null;
  }

  play(key: SfxKey, streak = 0): void {
    if (key === 'sfx-correct') this.chime(streak);
    else this.thunk();
  }

  /** Crisp two-partial chime; pitch climbs a semitone per streak step (cap +12). */
  private chime(streak: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const freq = 523.25 * Math.pow(2, Math.min(Math.max(streak - 1, 0), 12) / 12); // C5 and up

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    env.connect(this.master);

    const partials: Array<[number, number, OscillatorType]> = [
      [freq, 1.0, 'sine'],
      [freq * 1.5, 0.35, 'sine'], // a fifth of sparkle
      [freq * 2.0, 0.18, 'triangle'],
    ];
    for (const [f, amp, type] of partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }

  /** Soft underwater thunk — low sine with a quick pitch drop, never harsh. */
  private thunk(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.2, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    osc.connect(filter).connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /** Quiet underwater pad: two low detuned partials, slow swell, gentle filter drift. */
  startAmbient(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.ambient) return;
    const t = ctx.currentTime;
    const stops: Array<() => void> = [];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 2.2); // quiet, fades in
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.4;
    gain.connect(filter).connect(this.master);

    for (const [f, amp] of [
      [55, 1.0],
      [82.4, 0.5],
      [110.3, 0.22], // slightly off the octave for a watery beat
    ] as Array<[number, number]>) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g).connect(gain);
      osc.start(t);
      stops.push(() => osc.stop());
    }

    // slow swell so the pad breathes
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start(t);
    stops.push(() => lfo.stop());

    this.ambient = { gain, stops };
  }

  stopAmbient(): void {
    if (!this.ambient || !this.ctx) return;
    const { gain, stops } = this.ambient;
    this.ambient = null;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => stops.forEach((s) => s()), 600);
  }
}

export const audio = new AudioEngine();
