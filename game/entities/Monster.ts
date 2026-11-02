import * as Phaser from "phaser";
import { TILE_SIZE, TileCode, isSolid } from "@/game/map/tiles";
import {
  bossFrame,
  minionFrameForSlug,
} from "@/game/map/tileFrames";
import { getMinionForRoom } from "@/lib/monsters";
import type { FindingMeta, FloorMap, Room, WeaknessType } from "@/lib/domain/types";

let encounterCounter = 0;

export class Monster {
  readonly sprite: Phaser.GameObjects.Image;
  private exclamation: Phaser.GameObjects.Text | null = null;
  private breathTween: Phaser.Tweens.Tween | null = null;

  readonly encounterId: string;
  readonly encounterKey: string;
  readonly findingId: string;
  readonly bossSlug: string;
  readonly isBoss: boolean;
  readonly floor: number;
  readonly roomIndex: number;
  readonly roomId: string;
  readonly weaknessType: WeaknessType;
  readonly evidenceQuote: string;

  tileX: number;
  tileY: number;

  resolved = false;
  private moving = false;
  private readonly room: Room;

  constructor(
    scene: Phaser.Scene,
    worldX: number,
    worldY: number,
    isBoss: boolean,
    room: Room,
    floorOrder: number,
    meta?: FindingMeta,
    spawn?: {
      findingId?: string | null;
      bossSlug?: string;
      weaknessType?: WeaknessType;
      evidenceQuote?: string;
    },
    monsterIndex = 0,
  ) {
    encounterCounter++;
    this.encounterId = `enc-${encounterCounter}`;
    this.encounterKey = `${room.id}:${monsterIndex}`;
    this.findingId = spawn?.findingId ?? room.findingId ?? "";
    this.isBoss = isBoss;
    this.floor = floorOrder;
    this.roomIndex = parseInt(room.id.split("-r")[1] ?? "0", 10);
    this.roomId = room.id;
    this.room = room;
    const minion = getMinionForRoom(floorOrder, this.roomIndex);
    this.bossSlug = spawn?.bossSlug ?? (isBoss ? `boss-floor-${floorOrder}` : `minion-${minion.slug}`);
    this.weaknessType = spawn?.weaknessType ?? meta?.weaknessType ?? "gap_unsupported";
    this.evidenceQuote = spawn?.evidenceQuote ?? meta?.evidenceQuote ?? "";

    this.tileX = Math.floor(worldX / TILE_SIZE);
    this.tileY = Math.floor(worldY / TILE_SIZE);

    const frame = isBoss
      ? bossFrame(spawn?.bossSlug, floorOrder)
      : minionFrameForSlug(minion.slug, floorOrder);

    this.sprite = scene.add.image(worldX, worldY, "tiles", frame);
    this.sprite.setOrigin(0.5, 0.5);

    if (isBoss) {
      // Boss is drawn at 2x scale
      this.sprite.setScale(2);
      // Breathing tween: subtle pulse
      this.breathTween = scene.tweens.add({
        targets: this.sprite,
        scaleX: 2.08,
        scaleY: 2.08,
        duration: 900,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      // Scale pulse instead of moving y: chase movement also tweens x/y.
      this.breathTween = scene.tweens.add({
        targets: this.sprite,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 1100 + Math.random() * 500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // "!" marker above sprite so player knows they can interact
    this.exclamation = scene.add.text(worldX, worldY - TILE_SIZE * (isBoss ? 1.5 : 1), "!", {
      fontSize: "10px",
      color: "#ffdd44",
      fontFamily: "Arial, sans-serif",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  /**
   * Called when a boss:hit event fires.
   * Shake the sprite, flash red, show a floating damage number.
   */
  playHit(scene: Phaser.Scene, damage: number): void {
    if (this.resolved) return;

    const origX = this.sprite.x;

    scene.tweens.add({
      targets: this.sprite,
      x: { from: origX - 3, to: origX + 3 },
      duration: 40,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 3,
      onComplete: () => { this.sprite.x = origX; },
    });

    this.sprite.setTint(0xff4444);
    scene.time.delayedCall(120, () => {
      if (!this.resolved) this.sprite.clearTint();
    });

    const label = damage === 0 ? "MISS" : `-${damage}`;
    const color = damage === 0 ? "#aaaaaa" : "#ff4444";
    const dmgText = scene.add.text(this.sprite.x, this.sprite.y - 8, label, {
      fontSize: "10px",
      color,
      fontFamily: "Arial, sans-serif",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(100);

    scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - 30,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => { dmgText.destroy(); },
    });
  }

  markResolved(result: "won" | "conceded" | "disputed" | "fled"): void {
    this.resolved = true;
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.exclamation = null;

    // Conceded monsters stay in the room as greyed-out witnesses. Only a
    // real win (or a disputed finding) removes the sprite.
    if (result === "conceded") {
      this.sprite.setTint(0x6b7280);
      this.sprite.setAlpha(0.45);
      return;
    }

    const scene = this.sprite.scene;
    scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 400,
      ease: "Linear",
      onComplete: () => { this.sprite.destroy(); },
    });
  }

  /**
   * Chase the player while they are inside this monster's room.
   * Movement is one tile at a time, bounded by the room and blocking tiles.
   */
  updateChase(
    playerTile: { x: number; y: number },
    floorMap: FloorMap,
    occupied: ReadonlySet<string>,
  ): void {
    if (this.resolved || this.moving) return;

    const minX = this.room.rect.x + 1;
    const maxX = this.room.rect.x + this.room.rect.width - 2;
    const minY = this.room.rect.y + 1;
    const maxY = this.room.rect.y + this.room.rect.height - 2;
    const insideRoom =
      playerTile.x >= minX &&
      playerTile.x <= maxX &&
      playerTile.y >= minY &&
      playerTile.y <= maxY;
    if (!insideRoom) return;
    if (playerTile.x === this.tileX && playerTile.y === this.tileY) return;

    const startKey = `${this.tileX},${this.tileY}`;
    const goalKey = `${playerTile.x},${playerTile.y}`;
    if (startKey === goalKey) return;

    const queue: Array<{ x: number; y: number }> = [{ x: this.tileX, y: this.tileY }];
    const previous = new Map<string, string | null>([[startKey, null]]);
    let found = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.x},${current.y}`;
      if (currentKey === goalKey) {
        found = true;
        break;
      }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const key = `${nx},${ny}`;
        if (previous.has(key)) continue;
        if (occupied.has(key) && key !== goalKey) continue;
        const code = (floorMap.tiles[ny]?.[nx] ?? TileCode.VOID) as TileCode;
        if (isSolid(code) || code === TileCode.VOID) continue;
        previous.set(key, currentKey);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!found) return;

    let stepKey = goalKey;
    while (true) {
      const parent = previous.get(stepKey);
      if (!parent || parent === startKey) break;
      stepKey = parent;
    }
    const [stepX, stepY] = stepKey.split(",").map(Number) as [number, number];
    if (stepX === this.tileX && stepY === this.tileY) return;

    this.tileX = stepX;
    this.tileY = stepY;
    this.moving = true;
    if (this.exclamation) {
      this.exclamation.setPosition(
        stepX * TILE_SIZE + TILE_SIZE / 2,
        stepY * TILE_SIZE + TILE_SIZE / 2 - TILE_SIZE * (this.isBoss ? 1.5 : 1),
      );
    }
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      x: stepX * TILE_SIZE + TILE_SIZE / 2,
      y: stepY * TILE_SIZE + TILE_SIZE / 2,
      duration: 170,
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
      },
    });
  }

  /** Remove immediately (used when resuming a saved run). */
  markResolvedImmediate(): void {
    this.resolved = true;
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.exclamation = null;
    this.sprite.destroy();
  }

  /** Hard destroy (used on floor:retry). */
  destroy(): void {
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.sprite.destroy();
  }
}
