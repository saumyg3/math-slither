# Math Slither, Art Bible (Track B)

Canon for everything that renders **inside the canvas** (the empty center the HUD frames). The DOM HUD is already done by Claude Design and is out of scope here. Backend is Ludo AI. Follow the discipline: mood, palette, anchor, lock, batch, QA.

## 1. Mood
Bioluminescent deep-water arcade. Glowing creatures and luminous answer-bubbles over near-black water. Dark and calm until the player scores, then a burst of light. Light is the reward.

## 2. Palette (from the seeds)
| Role | Hex |
|---|---|
| Deep water (background base) | `#04141C` |
| Water (lighter depth) | `#07303A` |
| Caustic light | `#13525E` |
| Player 1 / default tint | cyan `#3FE0D0` |
| Player 2 | pink `#FF4FA3` |
| Player 3 | lime `#B6FF3C` |
| Player 4 | amber `#FFB23E` |
| Orb / glow core | warm white `#FFF6E6` |

Dominant darks, a few sharp luminous accents, never an even spread.

## 3. Style tokens
- Soft inner glow, no hard cartoon outlines that fight the light.
- Slightly stylized, clean readable silhouettes that hold up small.
- Everything that sits on the field is a transparent PNG, centered, with generous padding.
- Consistent omnidirectional glow and saturation across the whole set.
- No baked text or numbers, ever (numbers are code).

## 4. The prompt anchor (style lock)
Generate ONE anchor image first, then generate every other still **in that style** (`generateWithStyle`) so the set stays coherent. Prepend this to every still prompt:

```
Bioluminescent deep-water arcade game asset, top-down, soft inner glow on a
near-black background, slightly stylized, clean readable silhouette, transparent
background, no text, no numbers, centered with generous padding, crisp edges,
high-quality 2D game sprite.
```

## 5. Asset manifest
Declare in `src/assets-manifest.ts` (same shape as their `assets-manifest.ts`):

```ts
// Math Slither — canvas assets
export const SPRITES = [
  { key: 'eel-head',    file: 'eel-head.png',    note: 'luminous near-white base; setTint per player' },
  { key: 'eel-segment', file: 'eel-segment.png', note: 'single tileable body segment; setTint per player' },
  { key: 'orb',         file: 'orb.png',         note: 'glowing answer bubble; NO baked number — Phaser text on top' },
] as const;

export const SHEETS = [
  // animateSprite: model 'eagle', frames 25, frame_size 384, duration 1 -> 1920x1920, 25fps
  { key: 'orb-pop', file: 'orb-pop.png', frames: 25, frameSize: 384, fps: 25, note: 'correct-answer bloom' },
] as const;

export const TILES = [
  { key: 'water-bg', file: 'water-bg.png', note: 'seamless, opaque, low-contrast caustic water' },
] as const;

export const FX = [
  { key: 'spark',  file: 'spark.png',  note: 'glow spark for the correct-answer particle burst' },
  { key: 'bubble', file: 'bubble.png', note: 'optional ambient rising bubble' },
] as const;

export const SFX = [
  { key: 'sfx-correct', file: 'correct.mp3', note: 'optional — bright chime' },
  { key: 'sfx-wrong',   file: 'wrong.mp3',   note: 'optional — soft thunk, never harsh' },
  { key: 'sfx-ambient', file: 'ambient.mp3', note: 'optional — underwater loop' },
] as const;
```

## 6. Ludo prompts (anchor + subject)
Stills (prepend the anchor from section 4):
- **eel-head:** a glowing eel head, smooth luminous body in near-white so it can be color-tinted, small bright eye, mouth slightly open, facing right.
- **eel-segment:** one single glowing eel body segment, smooth rounded capsule, near-white luminous, tileable, no head and no tail, no eye.
- **orb:** a glowing translucent plankton bubble, warm-white inner light, soft rim glow, perfectly round, glassy.
- **spark (FX):** a single small soft glowing spark, warm-white core with a cyan halo, round, for a particle burst.
- **bubble (FX, optional):** a small translucent rising water bubble with a faint rim highlight.

Animation (`animateSprite`, no anchor needed, match the style):
- **orb-pop:** a glowing bubble bursting into a bloom of soft light and small sparks, smooth pop sequence, warm-white and cyan glow.

Tile (opaque, seamless — not the anchor, it is a texture):
- **water-bg:** seamless tileable top-down deep-water texture, near-black teal, faint cyan caustic light ripples, very low contrast, no focal point, no creatures.

Audio (optional, `createSoundEffect` / `createMusic`):
- **correct:** a short bright magical chime.
- **wrong:** a soft muffled underwater thunk, gentle, not harsh.
- **ambient:** a calm looping underwater ambience with faint bubbles.

## 7. Generation settings (their highest-quality defaults)
- Stills (SPRITES / TILES / FX): `ludo.createImage` for the anchor, then `ludo.generateWithStyle` for the rest. Cut transparency on sprites and FX with `ludo.removeBackground` (the water-bg tile stays opaque).
- Animations (SHEETS): `ludo.animateSprite` with `model: "eagle"`, `frames: 25`, `frame_size: 384`, `duration: 1` → a 1920×1920 sheet at 25 fps. Stay under the 4096 WebGL texture cap (1920 is safe).
- Post-process every generated sprite: it comes out non-power-of-two, so resize to a power-of-two and set `mipmapFilter`, or it renders pixelated in Phaser. This bites every game.
- In `BootScene`: set `frameWidth`/`frameHeight` = `frame_size` (384) and `anims.create({ frameRate })` = `frames / duration` (25).
- Auth: set `LUDO_API_KEY` and call `ludo.validateApiKey()` before generating.

## 8. Code-side rules (not art)
- Numbers on orbs are Phaser `Text` in Lexend, drawn over the orb sprite at runtime. Never baked into the image.
- The four player colors come from `setTint()` on the near-white eel base, not from four separate generations.
- The arena border / walls are a code-drawn glowing stroke, not a Ludo asset.
- The eel's shimmer and glow pulse are code (an alpha / tint tween), so a single static segment sprite is enough.

## 9. QA checklist (manual — stands in for their qa-game-art gate)
Generation is not done until each asset passes:
- Sprites and FX are cleanly transparent (no leftover halos from background removal); the water tile is seamless.
- On-palette, with the soft glow style consistent across the whole set (the anchor did its job).
- Reads clearly at game scale: the eel head is distinct from the body, and an orb's number stays legible drawn over it.
- No baked text or numbers anywhere.

## 10. How to run Ludo (without their internal harness)
You do not have their `dungeon-of-digits` asset-gen scripts, so either:
- Use the Ludo web app: generate each asset from the prompts above, download the PNGs, then run background removal and a power-of-two resize. Simplest path.
- Or write a minimal `ludo-client.ts` that calls the Ludo API (`createImage` → `generateWithStyle` → `animateSprite` → `removeBackground`), run with `node --env-file=.env.local`, and call `validateApiKey()` first. This is what enforces the anchor-then-batch consistency.
