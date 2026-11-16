import * as Phaser from "phaser";
import { DungeonScene } from "./DungeonScene";
import { TILE_SIZE } from "@/game/map/tiles";
import type { FloorMap } from "@/lib/domain/types";

/** Eldravos' throne hall: red carpet, pillars, heavy crimson light. */
export class ThroneScene extends DungeonScene {
  constructor() {
    super("ThroneScene");
  }

  create(): void {
    super.create();
    this.decorateThrone();
  }

  private decorateThrone(): void {
    const map = this.game.registry.get("floorMap") as FloorMap | undefined;
    if (!map) return;

    this.cameras.main.setBackgroundColor("#0a0507");

    for (const room of map.rooms) {
      const { x, y, width, height } = room.rect;
      const centreX = (x + width / 2) * TILE_SIZE;
      const centreY = (y + height / 2) * TILE_SIZE;

      const glow = this.add
        .image(centreX, centreY, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xcf5c68)
        .setAlpha(room.isBoss ? 0.4 : 0.22)
        .setDepth(3);
      glow.setDisplaySize(width * TILE_SIZE * 1.9, height * TILE_SIZE * 1.9);
      this.tweens.add({
        targets: glow,
        alpha: glow.alpha * 0.55,
        duration: 1300 + Math.random() * 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const pillars: Array<[number, number]> = [
        [x + 1, y + 1],
        [x + width - 2, y + 1],
        [x + 1, y + height - 2],
        [x + width - 2, y + height - 2],
      ];
      for (const [tileX, tileY] of pillars) {
        this.add
          .rectangle(
            (tileX + 0.5) * TILE_SIZE,
            (tileY + 0.5) * TILE_SIZE,
            TILE_SIZE * 0.8,
            TILE_SIZE * 1.1,
            0x3a2730,
            0.95,
          )
          .setDepth(2.4);
        this.add
          .rectangle(
            (tileX + 0.5) * TILE_SIZE,
            (tileY + 0.15) * TILE_SIZE,
            TILE_SIZE * 0.9,
            TILE_SIZE * 0.25,
            0xe9b85d,
            0.6,
          )
          .setDepth(2.5);
      }

      if (room.isBoss) {
        this.add
          .rectangle(centreX, centreY, width * TILE_SIZE * 0.6, height * TILE_SIZE * 0.5, 0x5c141f, 0.7)
          .setDepth(1.6);
        this.add
          .rectangle(centreX, centreY, width * TILE_SIZE * 0.55, height * TILE_SIZE * 0.45)
          .setStrokeStyle(2, 0xe9b85d, 0.7)
          .setDepth(1.7);
      }
    }
  }
}
