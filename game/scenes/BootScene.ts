import * as Phaser from "phaser";
import { CHARACTER_PATHS } from "@/lib/sprites/characters";

/**
 * BootScene: loads all assets, then starts DungeonScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Load the Kenney Tiny Dungeon spritesheet.
    // Tile size: 16×16 px, spacing: 1 px between tiles.
    // Key 'tiles' is used by DungeonScene (tilemap layers) and entity sprites.
    this.load.spritesheet("tiles", "/assets/tiny-dungeon/Tilemap/tilemap.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    });
    // Kenney Roguelike pack (CC0) — loot/props scattered in rooms. 1 px spacing.
    this.load.spritesheet("rl", "/assets/roguelike/roguelikeSheet_transparent.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    });
  }

  create(): void {
    // Apply NEAREST filter so pixel art stays crisp at integer zooms.
    this.textures.get("tiles").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("rl").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.createGlowTexture("glow");
    this.createGlowTexture("glow-small");
    this.createDustTexture("dust");
    this.createCharacterTextures();
    this.scene.start("DungeonScene");
  }

  /** Soft radial light used for room ambience and torches. */
  private createGlowTexture(key: string): void {
    if (this.textures.exists(key)) return;
    const size = 128;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) return;
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }

  /**
   * Rasterise the exact same pixel paths used by the React loadout into Phaser
   * textures, so the chosen character is the one that walks the dungeon.
   */
  private createCharacterTextures(): void {
    for (const [slug, paths] of Object.entries(CHARACTER_PATHS)) {
      const key = `char-${slug}`;
      if (this.textures.exists(key)) continue;
      const texture = this.textures.createCanvas(key, 32, 32);
      if (!texture) continue;
      const ctx = texture.getContext();
      ctx.clearRect(0, 0, 32, 32);
      for (const pathData of paths) {
        const path = new Path2D(pathData.d);
        if (pathData.fill && pathData.fill !== "none") {
          ctx.fillStyle = pathData.fill;
          ctx.fill(path);
        }
        if (pathData.stroke) {
          ctx.strokeStyle = pathData.stroke;
          ctx.lineWidth = pathData.strokeWidth ?? 1;
          ctx.stroke(path);
        }
      }
      texture.refresh();
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /** Tiny 2px particle sprite for floating dust/embers. */
  private createDustTexture(key: string): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, 2, 2);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 2, 2);
    texture.refresh();
  }
}
