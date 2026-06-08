# Math Slither, §0.7 Game Shape Decision Note

Phase 1 gate document for the `game-from-idea` pipeline. This fixes the shape of the game before any code or assets. Scope is the single-player take-home prototype; the architecture is built multiplayer-ready so it maps onto the `vs-score` / bridge path later.

## One-line pitch
A glowing eel grows by eating the answer orb that solves the problem on screen. Slither, but the food is math.

## Grade & topic
- Grade band: 3 to 6 (K-12, upper-elementary core).
- Topics (map to standard `problems.topic` rows): multiplication, addition/subtraction within 100, division facts, simple fractions, integers, intro order of operations.
- Prototype default stream: multiplication plus addition/subtraction.

## Math-as-verb (the core action IS the math)
Steering your eel into an orb is answering the problem. There is no "solve, then collect an unrelated reward" gap: the only way to grow and score is to physically move onto the correct answer. Reading the stem, picking the right number among distractors, and committing to it are one continuous motor act.

## Core mechanic / verb
Continuously steer a growing eel around a bounded arena. The HUD shows one problem (rendered by KaTeX). The arena holds five numbered answer orbs, one correct and four plausible distractors. Eat the correct orb to grow, score, and draw the next problem. Eat a wrong orb to lose a couple of tail segments and take a brief slow, with no game-over.

## Win / lose, and what failure feels like
- Outcome: maximize score (correct answers) inside the match timer; instant win at a score milestone.
- Failure is soft and K-12 appropriate. A wrong answer costs length and time, never an instant death or negative score, so a struggling kid keeps playing. The tension is the clock and your own near-misses, not punishment.

## Mode & match shape
- Mode (prototype): solo only, per the brief. `vs-score` and `flat` are design-accommodated in the UI but not implemented now.
- Match length: 75 seconds (snappy, inside their 60 to 90s band, tuned for "one more run").
- Problem count: timed flow, roughly 18 to 26 problems per match depending on speed; a `flat` diagnostic batch would be a fixed ~12 with no timer and no failure state.
- Stateful? Stateful within a match (length, score, streak, difficulty tier, timer); stateless across matches (no persistence needed for the prototype).
- Build sprint (production time-box): on the order of their ~30-minute target, a single focused sitting, with minor bugs accepted per the brief.

## The spine (named, mandatory)
Primary: within-match progression. A live streak counter plus adaptive difficulty that ramps as accuracy rises, against a shrinking 75-second timer, creates rising tension toward the finish.

Secondary (optional): a single local CPU rival eel sharing the arena for opponent pressure. It is fully offline with no networking, so it adds the head-to-head race feel without touching the multiplayer rule.

## Symmetric / variance
Seed-driven symmetric stream: one deterministic problem sequence per match seed. In solo this just drives your stream; the same seed makes a future `vs-score` match fair, because all players see the same sequence, per the head-to-head standard.

## Feel / reference games
Plays like Slither.io, feels like a glowing math arcade cabinet. Snappy, juicy, readable. References: Slither.io (steer-and-eat), their own Math Slice Dojo (the answer is the target), and the "just one more" pull of arcade .io games.

## Theme / aesthetic + palette/style seeds
Bioluminescent deep-water arcade: glowing eels and luminous answer-bubbles over near-black water.
- Palette seeds: deep teal / near-black water (`#04141C`, `#07303A`); bioluminescent accents cyan `#3FE0D0`, pink `#FF4FA3`, lime `#B6FF3C`, amber `#FFB23E`; warm-white orb glow `#FFF6E6`.
- Type: Unbounded (display and score), Lexend (UI and numerals, chosen because it is engineered for reading proficiency).
- Style references: deep-sea bioluminescence, Slither.io's clean readable arena, neon-on-dark arcade.

## Scope boundaries (take-home)
- In: the solo eat-the-answer loop, feel and juice (correct pop, wrong shake), the KaTeX stem, Ludo canvas art, a 1280x720 canvas, and the optional local rival.
- Out: networked multiplayer, the server-authoritative bridge, the `vs-score` and `flat` implementations, manifest/registry/ingest, and conformance. These are acknowledged, not built.

## Multiplayer-ready architecture (the differentiator)
The build separates a pure `game.ts` simulation from Phaser rendering, isolates grading behind one `grade(problem, answer)` function, and drives problems from a seeded stream. Turning this into their `vs-score` mode on the real bridge then becomes a wiring change (swap local grade for `submitAttempt`, the local stream for `fetchProblems`, add a match controller), not a rewrite. The writeup states this explicitly.

## Approval gate
Approve this shape before any code or assets. One open question for sign-off: keep the optional local CPU rival in scope (recommended, it serves the "addicting" criterion and showcases the spine), or cut it to stay closest to the 30-minute target?
