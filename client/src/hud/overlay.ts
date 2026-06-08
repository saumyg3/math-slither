// HUD overlay that tracks the REAL game canvas rect on screen. Phaser's own
// DOM container mis-positions elements once Scale.FIT shrinks/grows the canvas
// (panels drift off-screen at non-design window sizes), so screens mount into
// this plain fixed-position div instead. Panels anchor to its edges with
// viewport-relative offsets and render at native CSS pixel size — crisp at any
// window size, nothing clips.

import Phaser from 'phaser';

let overlay: HTMLElement | null = null;

export function getOverlay(game: Phaser.Game): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'ms-overlay';
  overlay.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:10;';
  document.body.appendChild(overlay);

  const sync = (): void => {
    const r = game.canvas.getBoundingClientRect();
    overlay!.style.left = `${r.left}px`;
    overlay!.style.top = `${r.top}px`;
    overlay!.style.width = `${r.width}px`;
    overlay!.style.height = `${r.height}px`;
  };
  sync();
  game.scale.on(Phaser.Scale.Events.RESIZE, () => requestAnimationFrame(sync));
  window.addEventListener('resize', () => requestAnimationFrame(sync));

  return overlay;
}

/** Mount a screen root into the overlay; auto-removed when the scene shuts down. */
export function mountScreen(scene: Phaser.Scene, root: HTMLElement): void {
  getOverlay(scene.game).appendChild(root);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => root.remove());
}
