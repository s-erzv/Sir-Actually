import * as Phaser from "phaser";

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
  }

  create(): void {
    // Apply NEAREST filter so pixel art stays crisp at integer zooms.
    this.textures.get("tiles").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.scene.start("DungeonScene");
  }
}
