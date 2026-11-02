import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { playSfx } from "@/game/audio";
import { TILE_SIZE, TileCode, isSolid } from "@/game/map/tiles";
import { playerFrameFor } from "@/game/map/tileFrames";
import type { FloorMap } from "@/lib/domain/types";
import type { Monster } from "./Monster";

const TWEEN_DURATION = 120; // ms per tile move

type Direction = "up" | "down" | "left" | "right";

const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1  },
  left:  { dx: -1, dy: 0  },
  right: { dx: 1,  dy: 0  },
};

export class Player {
  readonly sprite: Phaser.GameObjects.Image;

  private scene: Phaser.Scene;
  private floorMap: FloorMap;

  private tileX: number;
  private tileY: number;
  private moving = false;
  private lastLockedSfx = 0;
  private inputLocked = false; // locked during encounter overlay

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(
    scene: Phaser.Scene,
    worldX: number,
    worldY: number,
    _layer: Phaser.Tilemaps.TilemapLayer,  // kept for API compat; collision via floorMap
    floorMap: FloorMap,
    characterSlug?: string | null,
  ) {
    this.scene = scene;
    this.floorMap = floorMap;

    this.tileX = Math.floor(worldX / TILE_SIZE);
    this.tileY = Math.floor(worldY / TILE_SIZE);

    const artKey = `char-${characterSlug ?? "arka"}`;
    if (scene.textures.exists(artKey)) {
      this.sprite = scene.add.image(worldX, worldY, artKey);
      this.sprite.setScale(0.5);
    } else {
      this.sprite = scene.add.image(worldX, worldY, "tiles", playerFrameFor(characterSlug));
    }
    this.sprite.setOrigin(0.5, 0.5).setDepth(10);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up:    scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Lock/unlock input when encounter overlay opens/closes
    bus.on("encounter:start", () => { this.inputLocked = true; });
    bus.on("encounter:end",   () => { this.inputLocked = false; });

    // Floor intro and pause menu also freeze movement
    bus.on("game:pause", () => { this.inputLocked = true; });
    bus.on("game:resume", () => { this.inputLocked = false; });
  }

  getTile(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  /** Teleport to a tile position immediately (used on floor:retry). */
  teleport(tileX: number, tileY: number): void {
    this.tileX = tileX;
    this.tileY = tileY;
    this.moving = false;
    this.sprite.setPosition(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
    );
  }

  // Called from DungeonScene.update()
  update(monsters: Monster[]): void {
    if (this.moving || this.inputLocked) return;

    const dir = this.readDirection();
    if (!dir) return;

    const { dx, dy } = DIR_DELTA[dir];
    const nx = this.tileX + dx;
    const ny = this.tileY + dy;

    // Check collision using isSolid() on the logical tile code
    const code = (this.floorMap.tiles[ny]?.[nx] ?? TileCode.VOID) as TileCode;
    if (isSolid(code)) {
      // If blocked by a locked door, tell the overlay
      if (code === TileCode.DOOR_LOCKED) {
        bus.emit("door:locked", { doorTileX: nx, doorTileY: ny });
        const now = this.scene.time.now;
        if (now - this.lastLockedSfx > 500) {
          this.lastLockedSfx = now;
          playSfx("doorLocked");
        }
      }
      return;
    }

    if (code === TileCode.STAIRS) {
      if (monsters.every((monster) => monster.resolved)) {
        this.inputLocked = true;
        bus.emit("stairs:reach", { floor: this.floorMap.floorOrder });
      }
      return;
    }

    // Check if stepping into a monster tile
    const hitMonster = monsters.find(
      (m) => !m.resolved && m.tileX === nx && m.tileY === ny,
    );
    if (hitMonster) {
      this.inputLocked = true;
      bus.emit("encounter:start", {
        encounterId: hitMonster.encounterId,
        encounterKey: hitMonster.encounterKey,
        findingId:   hitMonster.findingId,
        bossSlug:    hitMonster.bossSlug,
        floor:       hitMonster.floor,
        room:        hitMonster.roomIndex,
        isBoss:      hitMonster.isBoss,
        weaknessType: hitMonster.weaknessType,
        evidenceQuote: hitMonster.evidenceQuote,
      });
      return;
    }

    this.moveTo(nx, ny);
  }

  private readDirection(): Direction | null {
    if (!this.scene.input.keyboard) return null;
    if (this.cursors.up.isDown || this.wasd.up.isDown) return "up";
    if (this.cursors.down.isDown || this.wasd.down.isDown) return "down";
    if (this.cursors.left.isDown || this.wasd.left.isDown) return "left";
    if (this.cursors.right.isDown || this.wasd.right.isDown) return "right";
    return null;
  }

  private moveTo(tx: number, ty: number): void {
    this.tileX = tx;
    this.tileY = ty;
    this.moving = true;
    playSfx("step");

    this.scene.tweens.add({
      targets: this.sprite,
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
      duration: TWEEN_DURATION,
      ease: "Sine.easeInOut",
      onComplete: () => { this.moving = false; },
    });
  }
}
