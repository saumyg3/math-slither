# Claude Code Kickoff — Build Math Slither (Phase 3)

Open Claude Code (or Cursor) in this project folder, then paste this in. It tells Claude Code what to read and how to build, adapted for a standalone prototype (you do NOT have the Stratacademy monorepo, bridge, or shared packages).

## Read first (source of truth)
Before writing code, read these files in this folder:
- `Game-Dev-SF.md` — the studio's game pipeline and standards.
- `game-shape-note.md` — the approved game shape (the single-player spec).
- `claude-design-brief.md` — the HUD / UX spec.
- `art-bible.md` — the canvas asset spec and manifest.
- `Math Slither HUD.html` — the Claude Design HUD output. If it is a thin shell, rebuild the HUD faithfully from `claude-design-brief.md` and the palette; if it is complete, lift its markup and CSS.

## What to build
A standalone, browser-playable, single-player prototype of Math Slither: a glowing eel that grows by steering into the answer orb that solves the on-screen math problem. Solo mode only. Make it fun and snappy first; minor bugs are acceptable per the assignment, so do not over-polish.

## Stack & setup (standalone, no monorepo)
- Vite + TypeScript + Phaser 4 (`phaser@^4`) in `client/`. If Phaser 4 hits a hard install/API blocker, Phaser 3 is an acceptable fallback for the prototype — do not burn the whole session fighting it.
- Add `katex` directly for the math stem (you do not have `@stratacademy/game-ui`).
- No `@stratacademy/*` packages, no bridge, no server. Replace server-authoritative grading with a LOCAL `grade()` function, kept isolated so it could later be swapped for a real `submitAttempt()`.
- Static SPA, deployable to Vercel.

## Architecture (keep it multiplayer-ready)
- `src/game.ts` — a PURE simulation (eel state, orbs, score, streak, HP/length, timer, difficulty tier). No Phaser or DOM imports. Deterministic, driven by a seeded RNG.
- `src/problems.ts` — a seeded stream: `nextProblem(tier)` returns `{ stem, correct, distractors[] }`. Default topics multiplication + add/sub (others available). Distractors are plausible near-misses, not random.
- `src/grade.ts` — `grade(problem, chosen)` returns the verdict. The ONLY place answers are checked. This is the swap point for a real server later.
- `src/scenes/` — `BootScene`, `TitleScene`, `PlayScene`, `HudScene`, `GameOverScene`.
- `src/assets-manifest.ts` — exactly the `SPRITES` / `SHEETS` / `TILES` / `FX` / `SFX` arrays from `art-bible.md`; load by key in `BootScene`.

## The HUD
- Rebuild the HUD as a DOM overlay from the HTML / design brief. Inject its CSS via an `injectStyles()` helper and embed the markup with `scene.add.dom(...)`; keep `dom: { createContainer: true }` in the Phaser config. Note: `scene.add.dom(el).node` is the element itself, and a thrown error inside any scene `update()` freezes the whole render loop (black canvas), so guard the loop.
- Preserve every `data-testid`.
- Render the math stem with KaTeX into the stem container; do not typeset math yourself.
- Leave the center transparent; the canvas (eel + orbs + water) renders behind it.

## The core loop (solo)
1. `PlayScene` shows the current problem (stem in the HUD via KaTeX) and spawns 5 numbered orbs: 1 correct + 4 distractors. The NUMBER on each orb is a Phaser `Text` in Lexend drawn over the orb, never baked art.
2. The eel follows a heading toward the pointer (mouse / touch); arrow keys / WASD as a fallback. Continuous movement, capped turn rate.
3. When the eel head overlaps an orb, call `grade()`:
   - Correct → +score, +1 length, +streak, play the orb-pop, brief bloom, next problem. Recompute difficulty every 6 answers (accuracy ≥ 80% tier up, ≤ 50% tier down).
   - Wrong → lose 2 segments (floor 3), brief slow, red flash + small shake, reset streak. No game-over, no negative score.
4. 75-second match timer (urgent in the final 10s). Win = highest score; instant win at 25.

## Art for now (placeholders)
Use simple placeholder shapes so the game plays WITHOUT Ludo: a tinted circle for the eel head, smaller circles for the body, plain glowing circles for the orbs, a flat dark background. Load them through `assets-manifest.ts` so swapping in the real Ludo PNGs later is a one-line change per asset.

## Optional (only if the loop already feels good)
Add one LOCAL CPU rival eel that steers toward answers at ~70% accuracy with a ~1.2s reaction delay, sharing the arena. Fully offline, no networking. It fills the leaderboard slot and adds race tension.

## Build order — milestones, each working before the next
- M0: the solo loop with placeholders — eel moves, orbs spawn with numbers, correct grows/scores, wrong penalizes, problems cycle, 75s timer, win/lose. No HUD polish yet.
- M1: wire the real DOM HUD (stem via KaTeX, score, timer, streak, HP, mode badge); preserve data-testids.
- M2: juice — orb-pop, correct bloom, wrong flash/shake, timer urgency, a couple of sounds.
- M3: optional CPU rival + leaderboard slot.
- M4: swap placeholders for the Ludo assets once generated; apply the power-of-two + mipmap fix from the art bible.

Start with M0, and stop to show me a runnable result after M0 before moving on.
