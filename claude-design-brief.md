You are designing the UI/UX for a browser-based educational arcade game.
Assume you have ZERO access to any codebase or prior conversation — this
brief stands alone. Read all of it before designing.

Deliverable: a SINGLE self-contained HTML file with inline CSS (no build
step, no external deps except one Google Fonts link). Semantic class names.
A `data-testid` attribute on every interactive element.

## Part 1 — The game (so you understand what you're styling)
- One-line pitch: a glowing eel grows by eating the answer orb that solves the
  math problem on screen. Slither, but the food is math.
- Theme / setting / fantasy: a bioluminescent deep-water arcade. The player is
  a glowing eel gliding through near-black water; the answer orbs are luminous
  plankton-bubbles. Mood: dark, alive, a little magical, and energetic.
- Audience: grades 3 to 6 (K-12), drilling mental math — multiplication and
  addition/subtraction by default, with division, simple fractions, integers,
  and intro order of operations also available.
- Math-as-verb: steering the eel into an orb IS answering. There is no "solve,
  then collect an unrelated reward" gap — the only way to grow and score is to
  physically move onto the correct answer among the floating options.
- Core loop, step by step: the problem stem appears in the HUD (rendered by
  KaTeX). Five numbered answer orbs drift in the play area, one correct and
  four plausible distractors. The player steers the eel toward an orb. On a
  CORRECT answer: the orb pops in a bloom of light, the eel flashes brighter
  head to tail, the score ticks up, the streak grows, and the next problem
  appears. On a WRONG answer: a short red edge-flash and a small screen shake,
  the eel loses a couple of tail segments and briefly slows, the streak resets;
  no game-over and no negative score.
- Match structure: 75 seconds; roughly 18 to 26 problems flow past in that
  time; win = highest score (correct answers), with an instant win at a score
  milestone. Failure is soft: a struggling player still finishes with a score,
  so the tension is the clock and near-misses, not punishment.
- Modes (the UI must accommodate all three):
  - solo — one player, no opponents (the mode shipped first).
  - vs-score (H2H) — 2 to 4 players race; show a live opponent leaderboard.
  - flat (diagnostic) — a fixed batch of problems, NO failure state, no timer pressure.
- The spine (what makes it tense): in solo, within-match progression — a
  rising streak and difficulty that ramps with accuracy, racing the 75-second
  timer. In vs-score, opponent pressure on the leaderboard. (A single local CPU
  rival may stand in for opponent pressure in solo.)
- The feel: juicy and snappy, like a glowing arcade cabinet. Light is the
  reward. Reference feel: Slither.io's glide-and-eat, with the readable
  answer-as-target of a math arcade game.

## Part 2 — Screens & states to design (every one)
For each: what it shows, what each control does, and the motion/transition intent.
1. Title / start screen. Game title in the display face over the dark-water
   mood; a primary Play control, a mode selector (solo / vs-score / flat), and
   a compact options affordance (math pack, difficulty). Entrance: a calm,
   staggered reveal.
2. Lobby / matchmaking (vs-score) — players joining as a list with names and
   ready states; a host-visible room code / invite control; a countdown to start.
3. In-match HUD — the core screen. Lay everything AROUND a transparent central
   gameplay viewport (leave the middle empty for game art). Anchor UI to the
   edges/corners. It must include:
   - the question/problem stem region, top and center, the single
     highest-contrast element on screen (math is rendered by KaTeX — style the
     container only; do not typeset the math yourself; leave room for one or
     two lines without reflowing),
   - the answer area: in THIS game the answer choices ARE the numbered orbs on
     the canvas, committed by steering, so do NOT design DOM answer buttons for
     the core loop. Provide ONLY a styled, hidden-by-default typed-input plus
     tap-able multiple-choice row, shown for the flat/diagnostic mode and as an
     accessibility / touch fallback,
   - score, a countdown timer (urgent in the final 10 seconds), the current
     streak, and a length / HP readout (in this game, HP is the eel's length),
   - an opponent leaderboard panel (vs-score) along one edge, collapsible in solo.
4. Correct-answer feedback state. A celebratory, luminous confirmation tied to
   the HUD (score pop / streak flare) that complements the canvas bloom.
5. Wrong-answer feedback state. A brief red flash / shake on the relevant HUD
   region; clearly readable, never punishing in tone.
6. Results / game-over screen (win and lose variants). Final score, accuracy,
   best streak; per-player rows with their color for vs-score; a short
   K-12-friendly summary; Play again and Back to title controls.

## Part 3 — Visual language
- Palette: deep teal / near-black water `#04141C` and `#07303A`; bioluminescent
  accents cyan `#3FE0D0`, hot pink `#FF4FA3`, lime `#B6FF3C`, amber `#FFB23E`;
  warm-white orb glow `#FFF6E6`; off-white HUD text `#EAFBFF`. Dominant darks
  with a few sharp luminous accents, not an even spread.
- Mood / texture: dark, deep, luminous water; faint caustic light; quiet until
  the player scores, then bursts of light.
- Type: a single Google Fonts link loading two families — display face
  Unbounded (title, score, big numbers) and readable face Lexend (stem, UI,
  body). Lexend is deliberate: it is engineered to improve reading proficiency,
  which fits a K-12 product and keeps the math maximally legible.
- Value hierarchy: the ACTIVE problem stem must be the highest-contrast thing
  on screen at all times. Everything else (score, timer, streak, leaderboard)
  recedes beneath it.
- Juice: celebratory luminous pops and a score flare on correct; a short red
  flash and shake on wrong; a timer that pulses urgent in the final 10 seconds;
  one orchestrated entrance on the title and HUD.

## Part 4 — Hard technical constraints
- Base canvas 1280×720, scaled to fit; design at that ratio.
- The HUD OVERLAYS a game canvas — the center must be transparent / empty so
  the canvas art shows through. Anchor UI to the edges/corners.
- KaTeX renders the stem; give the stem container room for one or two lines of
  math without reflowing the layout.
- `data-testid` on every interactive element (buttons, inputs, choices, the
  mode selector, leaderboard rows).

## Part 5 — Out of scope (do NOT do this)
- Do NOT design or draw sprites, characters, backgrounds, particles, or any
  in-canvas art. Those are generated separately. Design ONLY the DOM chrome
  that frames and overlays the canvas.
