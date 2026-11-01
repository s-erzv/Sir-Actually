import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { TILE_SIZE, TileCode, isSolid } from "@/game/map/tiles";
import { FRAME_PLAYER } from "@/game/map/tileFrames";
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
  ) {
    this.scene = scene;
    this.floorMap = floorMap;

    this.tileX = Math.floor(worldX / TILE_SIZE);
    this.tileY = Math.floor(worldY / TILE_SIZE);

    this.sprite = scene.add.image(worldX, worldY, "tiles", FRAME_PLAYER);
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
        findingId:   hitMonster.findingId,
        bossSlug:    hitMonster.bossSlug,
        floor:       hitMonster.floor,
        room:        hitMonster.roomIndex,
        weaknessType: hitMonster.weaknessType,
        evidenceQuote: hitMonster.evidenceQuote,
      });
      return;
    }

    this.moveTo(nx, ny);
  }

  private readDirection(): Direction | null {
    if (!this.scene.input.keyboard) return null;
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.up)
    ) return "up";
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.down) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.down)
    ) return "down";
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.left)
    ) return "left";
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.right) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.right)
    ) return "right";
    return null;
  }

  private moveTo(tx: number, ty: number): void {
    this.tileX = tx;
    this.tileY = ty;
    this.moving = true;

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
