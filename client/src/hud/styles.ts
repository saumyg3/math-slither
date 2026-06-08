// DOM HUD styles, matched to the Claude Design reference screenshots (title +
// in-match HUD): glassmorphic panels, gradient titles, bioluminescent glows.
// Injected once via injectStyles().
// Palette: deep water #04141C / #07303A, cyan #3FE0D0, pink #FF4FA3,
// lime #B6FF3C, amber #FFB23E, orb glow #FFF6E6, HUD text #EAFBFF.

const STYLE_ID = 'math-slither-hud-styles';

const CSS = /* css */ `
/* ---------- shared ---------- */
/* Screen roots fill the overlay (which tracks the real canvas rect); every
   panel anchors to an edge with relative offsets — nothing depends on the
   1280×720 design stage, so nothing clips at any window size. */
.hud-root, .title-screen, .results-screen, .pause-root {
  position: absolute;
  inset: 0;
  font-family: 'Lexend', sans-serif;
  color: #EAFBFF;
  pointer-events: none !important; /* canvas steering passes through; interactive bits opt back in */
  user-select: none;
}
.hud-root *, .title-screen *, .results-screen *, .pause-root * { box-sizing: border-box; }

.glass {
  background: rgba(5, 25, 31, 0.68);
  border: 1px solid rgba(63, 224, 208, 0.22);
  border-radius: 16px;
  backdrop-filter: blur(8px);
  box-shadow: 0 0 28px rgba(63, 224, 208, 0.10), inset 0 0 22px rgba(63, 224, 208, 0.04);
}

.hud-label {
  font-size: 10px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: rgba(234, 251, 255, 0.55);
}

/* ---------- background decoration (title) ---------- */
.current-band {
  position: absolute;
  left: -15%;
  width: 130%;
  height: 420px;
  border-radius: 50%;
  border-top: 2px solid rgba(63, 224, 208, 0.07);
  box-shadow: 0 -18px 50px rgba(63, 224, 208, 0.03);
  pointer-events: none;
}
.bg-orb {
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  color: rgba(4, 20, 28, 0.78);
  animation: orb-float var(--dur, 7s) ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes orb-float {
  from { transform: translateY(-14px); }
  to { transform: translateY(16px); }
}

/* ---------- title screen ---------- */
.brand-tag {
  position: absolute;
  top: 28px;
  left: 38px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: rgba(159, 216, 210, 0.9);
}
.brand-dot { width: 11px; height: 11px; border-radius: 50%; background: #3FE0D0; box-shadow: 0 0 14px #3FE0D0; }

.best-pill {
  position: absolute;
  top: 22px;
  right: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 14px;
  color: rgba(234, 251, 255, 0.75);
}
.best-dot { width: 9px; height: 9px; border-radius: 50%; background: #FFB23E; box-shadow: 0 0 10px #FFB23E; }
.best-value { font-weight: 700; color: #FFF6E6; }

/* NOTE: Phaser forces inline display:block on the DOM root — center via the
   inner stack, never with flex on the root element itself. */
.title-stack {
  position: absolute;
  left: 50%;
  top: 47%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}
.game-title { margin: 0; display: flex; flex-direction: column; align-items: center; line-height: 0.98; }
.game-title-math, .game-title-slither {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 92px;
  letter-spacing: 0.01em;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.game-title-math {
  background-image: linear-gradient(180deg, #FFFFFF 10%, #3FE0D0 90%);
  filter: drop-shadow(0 0 30px rgba(63, 224, 208, 0.45));
}
.game-title-slither {
  background-image: linear-gradient(180deg, #FF4FA3 15%, #FF8A5C 95%);
  filter: drop-shadow(0 0 30px rgba(255, 79, 163, 0.35));
}
.title-sub {
  margin: 2px 0 0;
  font-size: 19px;
  line-height: 1.5;
  max-width: 540px;
  color: rgba(214, 240, 242, 0.92);
}

.play-button {
  pointer-events: auto;
  margin-top: 12px;
  padding: 17px 64px;
  border: none;
  border-radius: 18px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 24px;
  color: #052a2b;
  background: linear-gradient(180deg, #8FF7E9, #3FE0D0);
  box-shadow: 0 0 44px rgba(63, 224, 208, 0.5), 0 0 12px rgba(63, 224, 208, 0.35);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.play-button:hover { transform: scale(1.04); box-shadow: 0 0 60px rgba(63, 224, 208, 0.7); }
.play-button:active { transform: scale(0.98); }

.choose-label { margin-top: 10px; font-size: 11px; letter-spacing: 0.4em; text-transform: uppercase; color: rgba(63, 224, 208, 0.85); }
.mode-selector { display: flex; gap: 6px; padding: 6px; border-radius: 18px; }
.mode-seg {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 22px;
  border: none;
  border-radius: 13px;
  background: transparent;
  color: #EAFBFF;
  font-family: 'Lexend', sans-serif;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}
.mode-name { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
.mode-desc { font-size: 12px; color: rgba(234, 251, 255, 0.55); }
.mode-seg.active { background: linear-gradient(180deg, #8FF7E9, #3FE0D0); color: #04141C; box-shadow: 0 0 22px rgba(63, 224, 208, 0.4); }
.mode-seg.active .mode-desc { color: rgba(4, 20, 28, 0.65); }
.mode-seg:disabled { cursor: not-allowed; }
.mode-seg:disabled .mode-name, .mode-seg:disabled .mode-desc { opacity: 0.55; }
.mode-seg:not(:disabled):not(.active):hover { background: rgba(63, 224, 208, 0.1); }
.soon-tag {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255, 178, 62, 0.16);
  border: 1px solid rgba(255, 178, 62, 0.4);
  color: #FFB23E;
  opacity: 1 !important;
}

.control-bar {
  position: absolute;
  bottom: 24px;
  /* centered via auto margins — .reveal's animated transform would clobber translateX */
  left: 0;
  right: 0;
  margin: 0 auto;
  width: max-content;
  max-width: calc(100% - 28px);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 20px;
  white-space: nowrap;
}
.control-bar .hud-label { margin: 0 4px; }
.bar-divider { width: 1px; height: 26px; background: rgba(63, 224, 208, 0.16); margin: 0 4px; }
.chip-btn {
  pointer-events: auto;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(63, 224, 208, 0.16);
  background: rgba(7, 48, 58, 0.5);
  color: #EAFBFF;
  font-family: 'Lexend', sans-serif;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.12s ease;
}
.chip-btn .chip-sym { opacity: 0.65; margin-right: 4px; }
.chip-btn.active {
  background: linear-gradient(180deg, #8FF7E9, #3FE0D0);
  color: #04141C;
  font-weight: 600;
  border-color: transparent;
  box-shadow: 0 0 16px rgba(63, 224, 208, 0.4);
}
.chip-btn.active .chip-sym { opacity: 0.8; }
.chip-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chip-btn:not(:disabled):not(.active):hover { background: rgba(63, 224, 208, 0.12); }

/* staggered entrance */
.reveal { opacity: 0; transform: translateY(14px); animation: reveal 0.55s ease-out forwards; }
@keyframes reveal { to { opacity: 1; transform: translateY(0); } }

/* ---------- in-match HUD ---------- */

/* score + streak — top-left */
.score-panel {
  position: absolute;
  top: 16px;
  left: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
}
.score-num {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 38px;
  line-height: 1;
  color: #FFF6E6;
  text-shadow: 0 0 22px rgba(63, 224, 208, 0.55);
}
.score-num.score-pop { animation: score-pop 0.32s ease-out; }
@keyframes score-pop {
  0% { transform: scale(1.3); text-shadow: 0 0 32px rgba(182, 255, 60, 0.9); }
  100% { transform: scale(1); }
}
.score-meta { display: flex; flex-direction: column; gap: 3px; }
.score-sub { font-size: 12px; color: rgba(234, 251, 255, 0.5); }

.streak-panel {
  position: absolute;
  top: 99px;
  left: 18px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 18px;
  border-radius: 999px;
}
.streak-dot {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #FFB23E, #FF4FA3 75%);
  box-shadow: 0 0 16px rgba(255, 79, 163, 0.6);
}
.streak-num { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 20px; color: #FFB23E; }
.streak-num.flare { animation: streak-flare 0.4s ease-out; }
@keyframes streak-flare {
  0% { transform: scale(1.35); text-shadow: 0 0 18px rgba(255, 178, 62, 0.9); }
  100% { transform: scale(1); }
}
.streak-word { font-size: 14px; color: rgba(234, 251, 255, 0.8); }

/* stem — top-center, the highest-contrast element */
.solve-label {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #3FE0D0;
  text-shadow: 0 0 12px rgba(63, 224, 208, 0.5);
}
.stem-panel {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 360px;
  max-width: 620px;
  min-height: 86px;            /* room for two lines without reflowing */
  padding: 14px 36px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(4, 26, 32, 0.78);
  border: 1px solid rgba(63, 224, 208, 0.34);
  backdrop-filter: blur(8px);
  box-shadow: 0 0 40px rgba(63, 224, 208, 0.22), inset 0 0 26px rgba(63, 224, 208, 0.05);
}
.stem { font-size: 34px; color: #FFF6E6; text-align: center; line-height: 1.25; }
.stem .katex { font-size: 1.12em; }
.stem-underline {
  width: 64%;
  height: 3px;
  margin-top: 8px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, #3FE0D0, transparent);
  box-shadow: 0 0 14px rgba(63, 224, 208, 0.8);
}
.stem-panel.stem-pop { animation: stem-pop 0.22s ease-out; }
@keyframes stem-pop {
  0% { transform: translateX(-50%) scale(1.08); }
  100% { transform: translateX(-50%) scale(1); }
}
.stem-panel.wrong { animation: wrong-flash 0.4s ease-out; }
@keyframes wrong-flash {
  0%, 60% { border-color: rgba(255, 79, 163, 0.9); box-shadow: 0 0 40px rgba(255, 79, 163, 0.55); }
  100% { border-color: rgba(63, 224, 208, 0.34); box-shadow: 0 0 40px rgba(63, 224, 208, 0.22); }
}
.stem-hint {
  position: absolute;
  top: 138px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  color: rgba(234, 251, 255, 0.6);
  white-space: nowrap;
}
.hint-dot { width: 8px; height: 8px; border-radius: 50%; background: #3FE0D0; box-shadow: 0 0 8px #3FE0D0; }

/* ring timer — top-right */
.timer-panel {
  position: absolute;
  top: 16px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 11px 18px;
}
.timer-ring { width: 56px; height: 56px; transform: rotate(-90deg); }
.timer-ring .ring-bg { fill: none; stroke: rgba(63, 224, 208, 0.15); stroke-width: 5; }
.timer-ring .ring-fg {
  fill: none;
  stroke: #3FE0D0;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 150.8;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 5px rgba(63, 224, 208, 0.7));
}
.timer-meta { display: flex; flex-direction: column; gap: 3px; }
.timer-value {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 30px;
  line-height: 1;
  color: #FFF6E6;
}
.timer-panel.urgent .timer-value { color: #FF4FA3; animation: timer-pulse 0.5s infinite alternate; }
.timer-panel.urgent .ring-fg { stroke: #FF4FA3; filter: drop-shadow(0 0 6px rgba(255, 79, 163, 0.8)); }
@keyframes timer-pulse { from { text-shadow: 0 0 4px rgba(255, 79, 163, 0.4); } to { text-shadow: 0 0 18px rgba(255, 79, 163, 0.9); } }

/* players leaderboard — right edge */
.leaderboard {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 196px;
  padding: 12px;
}
.lb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.lb-toggle {
  pointer-events: auto;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(63, 224, 208, 0.3);
  background: rgba(7, 48, 58, 0.6);
  color: #3FE0D0;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.lb-toggle:hover { background: rgba(63, 224, 208, 0.18); }
.leaderboard.collapsed .lb-toggle { transform: rotate(180deg); }
.lb-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.leaderboard.collapsed .lb-rows { display: none; }
.leaderboard.collapsed { width: auto; }
.lb-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border-radius: 11px;
  background: rgba(7, 48, 58, 0.55);
  font-size: 14px;
}
.lb-rank { width: 12px; font-size: 12px; color: rgba(234, 251, 255, 0.45); }
.lb-swatch { width: 10px; height: 10px; border-radius: 50%; background: var(--c, #3FE0D0); box-shadow: 0 0 9px var(--c, #3FE0D0); }
.lb-name { flex: 1; color: rgba(234, 251, 255, 0.9); font-weight: 600; }
.lb-score { font-family: 'Unbounded', sans-serif; font-size: 14px; color: #FFF6E6; }

/* mode pill + eel length — bottom-left */
.mode-pill-hud {
  position: absolute;
  left: 18px;
  bottom: 78px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: #EAFBFF;
}
.mode-dot { width: 9px; height: 9px; border-radius: 50%; background: #3FE0D0; box-shadow: 0 0 9px #3FE0D0; }

.length-panel { position: absolute; left: 18px; bottom: 16px; min-width: 248px; padding: 11px 15px; }
.length-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; gap: 18px; }
.length-value { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 17px; color: #B6FF3C; text-shadow: 0 0 12px rgba(182, 255, 60, 0.5); }
.length-cells { display: flex; gap: 4px; }
.length-cell { width: 15px; height: 9px; border-radius: 3px; background: rgba(63, 224, 208, 0.12); }
.length-cell.fill { background: linear-gradient(180deg, #D6FF7E, #B6FF3C); box-shadow: 0 0 8px rgba(182, 255, 60, 0.45); }

/* small round corner controls (mute, pause) */
.mute-btn, .pause-btn {
  pointer-events: auto;
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(63, 224, 208, 0.25);
  background: rgba(5, 25, 31, 0.68);
  color: #3FE0D0;
  cursor: pointer;
  transition: background 0.12s ease;
}
.mute-btn:hover, .pause-btn:hover { background: rgba(63, 224, 208, 0.15); }
.mute-btn svg, .pause-btn svg { width: 18px; height: 18px; fill: currentColor; }
.mute-btn { right: 14px; bottom: 14px; }
.pause-btn { top: 26px; right: 206px; } /* just left of the ring-timer panel */
.mute-btn .icon-off { display: none; }
.mute-btn.muted .icon-on { display: none; }
.mute-btn.muted .icon-off { display: block; }
.mute-btn.muted { color: rgba(234, 251, 255, 0.45); }

/* typed input + choice row — hidden fallback for flat mode / accessibility */
.answer-fallback { display: none; position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); }

/* ---------- pause overlay ---------- */
.pause-overlay {
  position: absolute;
  inset: 0;
  display: none;
  background: rgba(2, 12, 16, 0.66);
  backdrop-filter: blur(5px);
  pointer-events: auto; /* block the canvas while paused */
}
.pause-overlay.open { display: block; }
.pause-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 36px 56px;
  text-align: center;
}
.pause-title {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 34px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #3FE0D0;
  text-shadow: 0 0 28px rgba(63, 224, 208, 0.5);
}
.pause-panel .play-button { margin-top: 0; padding: 13px 52px; font-size: 19px; border-radius: 14px; }
.pause-actions { display: flex; gap: 14px; }

/* ---------- results screen ---------- */
.results-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: max-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 38px 56px;
  text-align: center;
}
.results-verdict {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 46px;
  line-height: 1.1;
}
.results-verdict.win { color: #B6FF3C; text-shadow: 0 0 36px rgba(182, 255, 60, 0.5); }
.results-verdict.lose { color: #FFB23E; text-shadow: 0 0 30px rgba(255, 178, 62, 0.4); }
.results-summary { margin: 0; font-size: 17px; color: rgba(234, 251, 255, 0.85); max-width: 420px; }
.results-matchup {
  display: flex;
  align-items: baseline;
  gap: 14px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
}
.results-matchup .mu-you { color: #3FE0D0; }
.results-matchup .mu-cpu { color: #FF4FA3; }
.results-matchup .mu-vs { font-family: 'Lexend', sans-serif; font-weight: 400; font-size: 14px; color: rgba(234, 251, 255, 0.5); }
.results-best-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid rgba(63, 224, 208, 0.22);
  background: rgba(7, 48, 58, 0.55);
  font-size: 14px;
  color: rgba(234, 251, 255, 0.75);
}
.results-best-pill .best-value { font-weight: 700; color: #FFF6E6; }
.new-best-tag {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(182, 255, 60, 0.16);
  border: 1px solid rgba(182, 255, 60, 0.45);
  color: #B6FF3C;
}
.results-stats { display: flex; gap: 38px; margin-top: 4px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat-value {
  font-family: 'Unbounded', sans-serif;
  font-weight: 600;
  font-size: 30px;
  color: #FFF6E6;
  text-shadow: 0 0 16px rgba(63, 224, 208, 0.45);
}
.results-actions { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
.results-actions .play-button { margin-top: 0; padding: 13px 44px; font-size: 18px; border-radius: 14px; }
.ghost-button {
  pointer-events: auto;
  padding: 12px 28px;
  border-radius: 999px;
  border: 1px solid rgba(63, 224, 208, 0.4);
  background: transparent;
  color: #3FE0D0;
  font-family: 'Lexend', sans-serif;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.ghost-button:hover { background: rgba(63, 224, 208, 0.12); }
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
