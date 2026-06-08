// M0: generates placeholder textures under the exact assets-manifest keys.
// M4 swap: replace each generate* call with this.load.image(key, `assets/${file}`)
// from SPRITES/TILES/FX — one line per asset, nothing else changes.

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeEelHead('eel-head');
    this.makeSegment('eel-segment');
    this.makeOrb('orb');
    this.makeSpark('spark');
    this.makeWater('water-bg');
    this.makeDot('mini-dot'); // minimap marker (UI, code-drawn — not part of the art manifest)
    this.scene.start('Title');
  }

  /** near-white glowing head (tinted per player at runtime, per the art bible) */
  private makeEelHead(key: string): void {
    const r = 22;
    const g = this.add.graphics();
    g.fillStyle(0xfff6e6, 0.25).fillCircle(r + 6, r + 6, r + 6);
    g.fillStyle(0xffffff, 1).fillCircle(r + 6, r + 6, r);
    // eye (dark dot, forward-right since sprites face right)
    g.fillStyle(0x04141c, 1).fillCircle(r + 6 + r * 0.45, r + 6 - r * 0.3, r * 0.18);
    g.generateTexture(key, (r + 6) * 2, (r + 6) * 2);
    g.destroy();
  }

  private makeSegment(key: string): void {
    const r = 16;
    const g = this.add.graphics();
    g.fillStyle(0xfff6e6, 0.2).fillCircle(r + 5, r + 5, r + 5);
    g.fillStyle(0xffffff, 1).fillCircle(r + 5, r + 5, r);
    g.generateTexture(key, (r + 5) * 2, (r + 5) * 2);
    g.destroy();
  }

  /** warm-white glowing answer bubble — number is drawn over it in code, never baked */
  private makeOrb(key: string): void {
    const r = 30;
    const pad = 14;
    const c = r + pad;
    const g = this.add.graphics();
    g.fillStyle(0xfff6e6, 0.12).fillCircle(c, c, r + 12);
    g.fillStyle(0xfff6e6, 0.25).fillCircle(c, c, r + 5);
    g.fillStyle(0xfff6e6, 1).fillCircle(c, c, r);
    g.fillStyle(0xffffff, 0.9).fillCircle(c - r * 0.3, c - r * 0.35, r * 0.22); // glassy highlight
    g.generateTexture(key, c * 2, c * 2);
    g.destroy();
  }

  private makeSpark(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x3fe0d0, 0.4).fillCircle(8, 8, 8);
    g.fillStyle(0xfff6e6, 1).fillCircle(8, 8, 4);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }

  /** plain white dot, tinted at runtime for minimap markers */
  private makeDot(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture(key, 8, 8);
    g.destroy();
  }

  /** flat deep-water tile with faint caustic blobs (placeholder for the Ludo tile) */
  private makeWater(key: string): void {
    const size = 256;
    const g = this.add.graphics();
    g.fillStyle(0x04141c, 1).fillRect(0, 0, size, size);
    // sparse, very low-contrast light patches
    const blobs: Array<[number, number, number]> = [
      [40, 60, 26],
      [180, 30, 20],
      [120, 150, 32],
      [220, 200, 22],
      [60, 220, 18],
    ];
    for (const [x, y, r] of blobs) {
      g.fillStyle(0x07303a, 0.5).fillCircle(x, y, r);
      g.fillStyle(0x13525e, 0.12).fillCircle(x, y, r * 0.5);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
