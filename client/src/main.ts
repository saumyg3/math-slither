import Phaser from 'phaser';
import 'katex/dist/katex.min.css';
import { audio } from './audio';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PlayScene } from './scenes/PlayScene';
import { HudScene } from './scenes/HudScene';
import { GameOverScene } from './scenes/GameOverScene';

// Unlock the AudioContext on the first user gesture (autoplay-policy requirement).
audio.installUnlockHandlers();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#04141C',
  dom: { createContainer: true }, // the M1 DOM HUD mounts into this container
  scale: {
    // RESIZE: the canvas always matches the window — no letterbox bars on any
    // edge. Scenes adapt the world/camera to the live viewport (see PlayScene).
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, TitleScene, PlayScene, HudScene, GameOverScene],
});
