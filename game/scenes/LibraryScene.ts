import * as Phaser from "phaser";
import { DungeonScene } from "./DungeonScene";
import { TILE_SIZE } from "@/game/map/tiles";
import type { FloorMap } from "@/lib/domain/types";

/** Nyxara's cursed library: cyan light, shelves, drifting pages. */
export class LibraryScene extends DungeonScene {
  constructor() {
    super("LibraryScene");
  }

  create(): void {
    super.create();
    this.decorateLibrary();
  }

  private decorateLibrary(): void {
    const map = this.game.registry.get("floorMap") as FloorMap | undefined;
    if (!map) return;

    for (const room of map.rooms) {
      const { x, y, width, height } = room.rect;
      const centreX = (x + width / 2) * TILE_SIZE;
      const centreY = (y + height / 2) * TILE_SIZE;

      for (let shelfX = x + 1; shelfX < x + width - 1; shelfX += 3) {
        this.add
          .rectangle(
            (shelfX + 0.6) * TILE_SIZE,
            (y + 0.55) * TILE_SIZE,
            TILE_SIZE * 2.1,
            TILE_SIZE * 0.55,
            0x3b2a1e,
            0.9,
          )
          .setDepth(2.4);
        this.add
          .rectangle(
            (shelfX + 0.6) * TILE_SIZE,
            (y + 0.55) * TILE_SIZE,
            TILE_SIZE * 0.5,
            TILE_SIZE * 0.4,
            room.isBoss ? 0xcf5c68 : 0x9fe3d8,
            0.75,
          )
          .setDepth(2.5);
      }

      const glow = this.add
        .image(centreX, centreY, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(room.isBoss ? 0xff8fa0 : 0x9fe3d8)
        .setAlpha(room.isBoss ? 0.34 : 0.2)
        .setDepth(3);
      glow.setDisplaySize(width * TILE_SIZE * 1.6, height * TILE_SIZE * 1.6);
      this.tweens.add({
        targets: glow,
        alpha: glow.alpha * 0.6,
        duration: 1800 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      for (let index = 0; index < 3; index += 1) {
        const page = this.add
          .rectangle(
            (x + 1 + Math.random() * (width - 2)) * TILE_SIZE,
            (y + 1 + Math.random() * (height - 2)) * TILE_SIZE,
            3,
            2,
            0xcffcf5,
            0.5,
          )
          .setDepth(3.2);
        this.tweens.add({
          targets: page,
          y: page.y - 20 - Math.random() * 24,
          alpha: 0,
          duration: 3200 + Math.random() * 2400,
          delay: Math.random() * 2000,
          repeat: -1,
          ease: "Sine.easeOut",
        });
      }
    }
  }
}
