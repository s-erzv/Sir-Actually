import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { playSfx } from "@/game/audio";
import { TILE_SIZE, TileCode, isSolid } from "@/game/map/tiles";
import { playerFrameFor } from "@/game/map/tileFrames";
import type { AttackStyle, FloorMap } from "@/lib/domain/types";
import type { Monster } from "./Monster";
import { pushHeld, releaseHeld, type Direction } from "./heldDirections";
import {
  attackFrame,
  idleFrame,
  sheetKey,
  walkAnimKey,
  type Facing,
} from "@/lib/sprites/sheets";

const TWEEN_DURATION = 120; // ms per tile move
/** A press that lands mid-step still fires if the step ends within this window. */
const BUFFER_MS = 160;

export type { Direction };

const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1  },
  left:  { dx: -1, dy: 0  },
  right: { dx: 1,  dy: 0  },
};

export class Player {
  readonly sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  /** Set when the character has an animated sheet. */
  private readonly animSlug: string | null = null;
  private facing: Facing = "down";
  private stopTimer: Phaser.Time.TimerEvent | null = null;

  private scene: Phaser.Scene;
  private floorMap: FloorMap;

  private tileX: number;
  private tileY: number;
  private moving = false;
  private lastLockedSfx = 0;
  private inputLocked = false; // locked during encounter overlay
  private held: Direction[] = [];
  private queued: { dir: Direction; at: number } | null = null;
  private lastMonsters: Monster[] = [];

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

    const slug = characterSlug ?? "arka";
    const artKey = `char-${slug}`;
    if (scene.textures.exists(sheetKey(slug))) {
      this.animSlug = slug;
      this.sprite = scene.add.sprite(worldX, worldY, sheetKey(slug), idleFrame("down"));
    } else if (scene.textures.exists(artKey)) {
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
      const dirs: Direction[] = ["up", "down", "left", "right"];
      for (const dir of dirs) {
        for (const key of [this.cursors[dir], this.wasd[dir]]) {
          key?.on("down", () => {
            this.held = pushHeld(this.held, dir);
            if (this.moving) this.queued = { dir, at: this.scene.time.now };
          });
          key?.on("up", () => {
            // Both bindings of a direction must be up before it is released.
            if (!this.cursors[dir]?.isDown && !this.wasd[dir].isDown) {
              this.held = releaseHeld(this.held, dir);
            }
          });
        }
      }
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
  /** Stop accepting movement (encounter, cutscene, stairs descent). */
  lockInput(): void {
    this.inputLocked = true;
  }

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
    this.lastMonsters = monsters;
    if (this.moving || this.inputLocked) return;
    const dir = this.takeQueued() ?? this.readDirection();
    if (dir) this.step(dir, monsters);
  }

  /** One-tile move, used by both keyboard and the touch D-pad. */
  step(dir: Direction, monsters: Monster[]): void {
    if (this.inputLocked) return;
    if (this.moving) {
      // Remember a press that arrives mid-step instead of dropping it.
      this.queued = { dir, at: this.scene.time.now };
      return;
    }

    this.face(dir);
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
      if (monsters.every((monster) => monster.resolved || monster.isDweller)) {
        this.inputLocked = true;
        const scene = this.scene as Phaser.Scene & { beginStairsDescent?: () => void };
        if (scene.beginStairsDescent) {
          scene.beginStairsDescent();
        } else {
          bus.emit("stairs:reach", { floor: this.floorMap.floorOrder });
        }
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
        severity: hitMonster.severity,
        evidenceQuote: hitMonster.evidenceQuote,
      });
      return;
    }

    this.moveTo(nx, ny);
  }

  /** Newest held direction. Keys released while the page lost focus are dropped. */
  private readDirection(): Direction | null {
    if (!this.scene.input.keyboard) return null;
    this.held = this.held.filter((dir) => this.cursors[dir]?.isDown || this.wasd[dir].isDown);
    return this.held[0] ?? null;
  }

  private takeQueued(): Direction | null {
    const queued = this.queued;
    this.queued = null;
    if (!queued || this.scene.time.now - queued.at > BUFFER_MS) return null;
    return queued.dir;
  }

  private moveTo(tx: number, ty: number): void {
    this.tileX = tx;
    this.tileY = ty;
    this.moving = true;
    playSfx("step");
    this.stopTimer?.remove();
    this.stopTimer = null;
    if (this.animSlug && this.sprite instanceof Phaser.GameObjects.Sprite) {
      this.sprite.anims.play(walkAnimKey(this.animSlug, this.facing), true);
    }

    this.scene.tweens.add({
      targets: this.sprite,
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
      duration: TWEEN_DURATION,
      // Linear keeps chained steps at one speed; ease-in-out stalled at every tile.
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
        // Chain the next step in the same tick so held keys never stutter.
        const next = this.inputLocked ? null : this.takeQueued() ?? this.readDirection();
        if (next) {
          this.step(next, this.lastMonsters);
          if (this.moving) return;
        }
        this.stopTimer = this.scene.time.delayedCall(60, () => this.standStill());
      },
    });
  }

  /** Turn to a direction without moving (bumping a wall, facing a monster). */
  private face(dir: Facing): void {
    this.facing = dir;
    if (!this.moving) this.standStill();
  }

  private standStill(): void {
    if (this.moving) return;
    if (this.animSlug && this.sprite instanceof Phaser.GameObjects.Sprite) {
      this.sprite.anims.stop();
      this.sprite.setFrame(idleFrame(this.facing));
    }
  }

  /** Strike in the character's weapon style; used when an answer lands. */
  attack(targetX: number, targetY: number, style: AttackStyle = "sword"): void {
    const homeX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const homeY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    const dx = targetX - homeX;
    const dy = targetY - homeY;
    this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up";
    if (this.animSlug && this.sprite instanceof Phaser.GameObjects.Sprite) {
      this.sprite.anims.stop();
      this.sprite.setFrame(attackFrame(this.facing));
    }
    const length = Math.hypot(dx, dy) || 1;
    if (style === "bow" && this.scene.textures.exists("fx-arrow")) {
      const arrow = this.scene.add
        .image(homeX, homeY, "fx-arrow")
        .setDepth(60)
        .setRotation(Math.atan2(dy, dx))
        .setScale(1.4);
      this.scene.tweens.add({
        targets: arrow,
        x: targetX,
        y: targetY,
        duration: 170,
        ease: "Quad.easeIn",
        onComplete: () => {
          arrow.destroy();
          this.standStill();
        },
      });
      return;
    }
    if (style === "shield" && this.scene.textures.exists("fx-shield")) {
      const shield = this.scene.add
        .image(homeX, homeY, "fx-shield")
        .setDepth(60)
        .setAlpha(0.9)
        .setScale(0.5)
        .setRotation(Math.atan2(dy, dx));
      this.scene.tweens.add({
        targets: shield,
        x: homeX + (dx / length) * 10,
        y: homeY + (dy / length) * 10,
        alpha: 0,
        duration: 190,
        ease: "Quad.easeOut",
        onComplete: () => {
          shield.destroy();
          this.standStill();
        },
      });
      return;
    }
    this.scene.tweens.add({
      targets: this.sprite,
      x: homeX + (dx / length) * 6,
      y: homeY + (dy / length) * 6,
      duration: 70,
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => {
        this.sprite.setPosition(homeX, homeY);
        this.standStill();
      },
    });
  }

  /** Recoil and flash when an answer costs a Heart. */
  hurt(fromX: number, fromY: number): void {
    const homeX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const homeY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    const length = Math.hypot(homeX - fromX, homeY - fromY) || 1;
    this.sprite.setTintFill(0xff5a5a);
    this.scene.tweens.add({
      targets: this.sprite,
      x: homeX + ((homeX - fromX) / length) * 5,
      y: homeY + ((homeY - fromY) / length) * 5,
      duration: 80,
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => {
        this.sprite.setPosition(homeX, homeY);
        this.sprite.clearTint();
      },
    });
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.35, duration: 90, yoyo: true, repeat: 3 });
  }
}
