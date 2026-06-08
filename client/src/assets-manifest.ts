// Math Slither — canvas assets (exactly the art-bible manifest).
// M0 ships placeholder textures generated in BootScene under these same keys,
// so swapping in the real Ludo PNGs later is a one-line change per asset.

export const SPRITES = [
  { key: 'eel-head', file: 'eel-head.png', note: 'luminous near-white base; setTint per player' },
  { key: 'eel-segment', file: 'eel-segment.png', note: 'single tileable body segment; setTint per player' },
  { key: 'orb', file: 'orb.png', note: 'glowing answer bubble; NO baked number — Phaser text on top' },
] as const;

export const SHEETS = [
  // animateSprite: model 'eagle', frames 25, frame_size 384, duration 1 -> 1920x1920, 25fps
  { key: 'orb-pop', file: 'orb-pop.png', frames: 25, frameSize: 384, fps: 25, note: 'correct-answer bloom' },
] as const;

export const TILES = [
  { key: 'water-bg', file: 'water-bg.png', note: 'seamless, opaque, low-contrast caustic water' },
] as const;

export const FX = [
  { key: 'spark', file: 'spark.png', note: 'glow spark for the correct-answer particle burst' },
  { key: 'bubble', file: 'bubble.png', note: 'optional ambient rising bubble' },
] as const;

export const SFX = [
  { key: 'sfx-correct', file: 'correct.mp3', note: 'optional — bright chime' },
  { key: 'sfx-wrong', file: 'wrong.mp3', note: 'optional — soft thunk, never harsh' },
  { key: 'sfx-ambient', file: 'ambient.mp3', note: 'optional — underwater loop' },
] as const;
