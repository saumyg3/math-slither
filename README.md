# Math Slither

A browser-based, slither.io-style educational math arcade. Steer a glowing eel into the orb showing the correct answer — eat it to grow, build a streak, and race a CPU rival to 15. Built for grades 3–6.

**Live demo:** https://math-slither.vercel.app

## How to play
- Steer the eel with your mouse (keyboard also works).
- A math problem shows at the top — glide onto the orb with the correct answer to score and grow.
- Keep a streak going for escalating feedback. First to 15 correct wins the race against the CPU rival; otherwise the highest score when the 75-second timer ends wins.

## Features
- Math is the core mechanic — eating the right answer *is* solving, not a quiz bolted on.
- Grade 3–6 content: multiplication and addition/subtraction by default, with division, fractions, integers, and order-of-operations packs, plus difficulty levels.
- Game feel: responsive steering, correct/wrong juice, synthesized Web Audio sound, and a session-best score.
- A CPU rival, a live leaderboard, a minimap, and a pause menu.
- Each racer has its own independent question-and-orb set, so you can't read the answer off a rival.

## Tech stack
Vite · TypeScript · Phaser · KaTeX (math rendering) · Web Audio API · deployed on Vercel.

## How it was built (AI-first workflow)
- Scoped with planning and art-direction docs.
- HUD designed in Claude Design.
- Implemented and iterated with Claude Code.

## Multiplayer-ready
Built single-player, but architected for multiplayer: each racer already has an independent orb field, and the leaderboard and rival are in place. Turning the CPU into real head-to-head play is a wiring change, not a rewrite.

## Run locally
From the `client` folder, run `npm install` then `npm run dev`, and open the localhost URL it prints.
