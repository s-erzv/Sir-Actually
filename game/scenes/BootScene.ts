import * as Phaser from "phaser";
import { CHARACTER_PATHS } from "@/lib/sprites/characters";
import {
  CHARACTER_SHEETS,
  SHEET_FRAME,
  sheetKey,
  walkAnimKey,
  walkFrames,
  type Facing,
} from "@/lib/sprites/sheets";

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
    // Animated character sheets (walk cycle in four directions + attack).
    for (const [slug, path] of Object.entries(CHARACTER_SHEETS)) {
      this.load.spritesheet(sheetKey(slug), path, {
        frameWidth: SHEET_FRAME,
        frameHeight: SHEET_FRAME,
      });
    }
  }

  create(): void {
    // Apply NEAREST filter so pixel art stays crisp at integer zooms.
    this.textures.get("tiles").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("rl").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.createGlowTexture("glow");
    this.createGlowTexture("glow-small");
    this.createDustTexture("dust");
    this.createDarknessTexture("darkness");
    this.createCharacterTextures();
    this.createCharacterAnimations();
    const map = this.game.registry.get("floorMap") as { dimension?: string } | undefined;
    const sceneKey =
      map?.dimension === "ghost"
        ? "LibraryScene"
        : map?.dimension === "throne"
          ? "ThroneScene"
          : "DungeonScene";
    this.scene.start(sceneKey);
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

  /**
   * Darkness with a hole of torchlight in the middle. Drawn over the world
   * and kept centred on the player, so the dungeon is only lit around them.
   */
  private createDarknessTexture(key: string): void {
    if (this.textures.exists(key)) return;
    const size = 1024;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) return;
    const ctx = texture.getContext();
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(5,6,10,0)");
    gradient.addColorStop(0.04, "rgba(5,6,10,0.04)");
    gradient.addColorStop(0.07, "rgba(5,6,10,0.5)");
    gradient.addColorStop(0.105, "rgba(5,6,10,0.84)");
    gradient.addColorStop(0.16, "rgba(5,6,10,0.93)");
    gradient.addColorStop(1, "rgba(5,6,10,0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  private createCharacterAnimations(): void {
    for (const slug of Object.keys(CHARACTER_SHEETS)) {
      const key = sheetKey(slug);
      if (!this.textures.exists(key)) continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const facing of ["down", "up", "left", "right"] as Facing[]) {
        const animKey = walkAnimKey(slug, facing);
        if (this.anims.exists(animKey)) continue;
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(key, { frames: walkFrames(facing) }),
          frameRate: 12,
          repeat: -1,
        });
      }
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
