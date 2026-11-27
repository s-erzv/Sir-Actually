import * as Phaser from "phaser";
import { CHARACTER_PATHS } from "@/lib/sprites/characters";
import { FLOOR_SHEET_KEY } from "@/game/map/tileFrames";
import {
  CHARACTER_SHEETS,
  SHEET_FRAME,
  sheetKey,
  walkAnimKey,
  walkFrames,
  type Facing,
} from "@/lib/sprites/sheets";
import {
  BOSS_SHEETS,
  MINION_SHEETS,
  bossHitAnim,
  bossHitKey,
  bossIdleAnim,
  bossIdleKey,
  bossWalkKey,
  minionArtKey,
  minionWalkAnim,
} from "@/lib/sprites/monsters";

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
    // Dedicated dungeon floor sheet (Ninja Adventure interior floors).
    this.load.spritesheet(FLOOR_SHEET_KEY, "/assets/ninja-adventure/tiles/interior-floor.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    // Animated character sheets (walk cycle in four directions + attack).
    for (const [slug, path] of Object.entries(CHARACTER_SHEETS)) {
      this.load.spritesheet(sheetKey(slug), path, {
        frameWidth: SHEET_FRAME,
        frameHeight: SHEET_FRAME,
      });
    }

    // Humanoid minions share the character sheet layout.
    for (const [slug, sheet] of Object.entries(MINION_SHEETS)) {
      this.load.spritesheet(minionArtKey(slug), sheet.path, {
        frameWidth: SHEET_FRAME,
        frameHeight: SHEET_FRAME,
      });
    }

    // Bosses have their own frame size and idle/hit/walk sheets.
    for (const [slug, sheet] of Object.entries(BOSS_SHEETS)) {
      this.load.spritesheet(bossIdleKey(slug), sheet.idle, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
      this.load.spritesheet(bossHitKey(slug), sheet.hit, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
      if (sheet.walk) {
        this.load.spritesheet(bossWalkKey(slug), sheet.walk, {
          frameWidth: sheet.frameWidth,
          frameHeight: sheet.frameHeight,
        });
      }
    }

    this.load.spritesheet("merchant", "/assets/ninja-adventure/npc/merchant.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image("shop-coin", "/assets/ninja-adventure/items/coin-gold.png");
    this.load.spritesheet("fx-cut", "/assets/ninja-adventure/fx/cut.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("fx-cut-double", "/assets/ninja-adventure/fx/cut-double.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("fx-flame", "/assets/ninja-adventure/fx/flame.png", {
      frameWidth: 20,
      frameHeight: 30,
    });
    this.load.image("fx-arrow", "/assets/ninja-adventure/fx/arrow.png");
    this.load.image("fx-shield", "/assets/ninja-adventure/fx/shield.png");
    this.load.image("item-potion", "/assets/ninja-adventure/items/potion.png");
    this.load.image("item-chest", "/assets/ninja-adventure/items/chest.png");
  }

  create(): void {
    // Apply NEAREST filter so pixel art stays crisp at integer zooms.
    this.textures.get("tiles").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("rl").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(FLOOR_SHEET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
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
    gradient.addColorStop(0.05, "rgba(5,6,10,0.02)");
    gradient.addColorStop(0.1, "rgba(5,6,10,0.28)");
    gradient.addColorStop(0.16, "rgba(5,6,10,0.62)");
    gradient.addColorStop(0.26, "rgba(5,6,10,0.84)");
    gradient.addColorStop(1, "rgba(5,6,10,0.9)");
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

    for (const slug of Object.keys(MINION_SHEETS)) {
      const key = minionArtKey(slug);
      if (!this.textures.exists(key)) continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const facing of ["down", "up", "left", "right"] as Facing[]) {
        const animKey = minionWalkAnim(slug, facing);
        if (this.anims.exists(animKey)) continue;
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(key, { frames: walkFrames(facing) }),
          frameRate: 10,
          repeat: -1,
        });
      }
    }

    for (const [slug, sheet] of Object.entries(BOSS_SHEETS)) {
      const idleKey = bossIdleKey(slug);
      if (this.textures.exists(idleKey)) {
        this.textures.get(idleKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
        if (!this.anims.exists(bossIdleAnim(slug))) {
          this.anims.create({
            key: bossIdleAnim(slug),
            frames: this.anims.generateFrameNumbers(idleKey, {
              start: 0,
              end: Math.max(0, sheet.idleFrames - 1),
            }),
            frameRate: 7,
            repeat: -1,
          });
        }
      }
      if (sheet.walk && sheet.walkFrames > 0) {
        const walkKey = bossWalkKey(slug);
        if (this.textures.exists(walkKey)) {
          this.textures.get(walkKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
          const walkAnim = `${slug}-boss-walk`;
          if (!this.anims.exists(walkAnim)) {
            this.anims.create({
              key: walkAnim,
              frames: this.anims.generateFrameNumbers(walkKey, {
                start: 0,
                end: Math.max(0, sheet.walkFrames - 1),
              }),
              frameRate: 8,
              repeat: -1,
            });
          }
        }
      }
      const hitKey = bossHitKey(slug);
      if (this.textures.exists(hitKey)) {
        this.textures.get(hitKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
        if (!this.anims.exists(bossHitAnim(slug))) {
          this.anims.create({
            key: bossHitAnim(slug),
            frames: this.anims.generateFrameNumbers(hitKey, {
              start: 0,
              end: Math.max(0, sheet.hitFrames - 1),
            }),
            frameRate: 12,
            repeat: 0,
          });
        }
      }
    }

    if (this.textures.exists("fx-flame")) {
      this.textures.get("fx-flame").setFilter(Phaser.Textures.FilterMode.NEAREST);
      if (!this.anims.exists("fx-flame-loop")) {
        this.anims.create({
          key: "fx-flame-loop",
          frames: this.anims.generateFrameNumbers("fx-flame", { start: 0, end: 9 }),
          frameRate: 12,
          repeat: -1,
        });
      }
    }

    for (const key of ["fx-arrow", "fx-shield", "item-potion", "item-chest"]) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    const fxFrames: Record<string, number> = { "fx-cut": 4, "fx-cut-double": 5 };
    for (const [key, count] of Object.entries(fxFrames)) {
      if (!this.textures.exists(key)) continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const animKey = `${key}-play`;
      if (this.anims.exists(animKey)) continue;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: count - 1 }),
        frameRate: 18,
        repeat: 0,
      });
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
