"use client";

import { useEffect, useRef } from "react";
import type { FloorMap } from "@/lib/domain/types";

interface PhaserGameProps {
  floorMap: FloorMap;
}

export default function PhaserGame({ floorMap }: PhaserGameProps) {
  const gameRef = useRef<import("phaser").Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    let game: import("phaser").Game | null = null;

    (async () => {
      const Phaser = await import("phaser");
      const { BootScene } = await import("@/game/scenes/BootScene");
      const { DungeonScene } = await import("@/game/scenes/DungeonScene");

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-root",
        width: "100%",
        height: "100%",
        backgroundColor: "#0D0F15",
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        scene: [BootScene, DungeonScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });

      // Pass floorMap to DungeonScene via the registry so it's available in init()
      game.registry.set("floorMap", floorMap);
      gameRef.current = game;
    })();

    return () => {
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [floorMap]);

  // The Phaser canvas is mounted inside #game-root — no extra DOM element needed.
  return null;
}
