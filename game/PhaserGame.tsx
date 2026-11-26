"use client";

import { useEffect, useRef } from "react";
import type { FloorMap } from "@/lib/domain/types";

interface PhaserGameProps {
  floorMap: FloorMap;
  characterSlug?: string;
  resolvedKeys?: string[];
}

export default function PhaserGame({ floorMap, characterSlug, resolvedKeys }: PhaserGameProps) {
  const gameRef = useRef<import("phaser").Game | null>(null);
  const resolvedKeysRef = useRef(resolvedKeys ?? []);
  resolvedKeysRef.current = resolvedKeys ?? [];

  useEffect(() => {
    if (gameRef.current) return;

    let game: import("phaser").Game | null = null;
    let cancelled = false;

    (async () => {
      const Phaser = await import("phaser");
      const { BootScene } = await import("@/game/scenes/BootScene");
      const { DungeonScene } = await import("@/game/scenes/DungeonScene");
      const { LibraryScene } = await import("@/game/scenes/LibraryScene");
      const { ThroneScene } = await import("@/game/scenes/ThroneScene");

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-root",
        width: "100%",
        height: "100%",
        backgroundColor: "#0D0F15",
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        scene: [BootScene, DungeonScene, LibraryScene, ThroneScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });

      if (cancelled) {
        game.destroy(true);
        return;
      }
      // Pass floorMap and the chosen character to DungeonScene via the registry.
      game.registry.set("floorMap", floorMap);
      game.registry.set("characterSlug", characterSlug);
      game.registry.set("resolvedKeys", resolvedKeysRef.current);
      gameRef.current = game;
      if (process.env.NODE_ENV !== "production") {
        (window as Window & { __game?: import("phaser").Game }).__game = game;
      }
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [floorMap, characterSlug]);

  // The Phaser canvas is mounted inside #game-root — no extra DOM element needed.
  return null;
}
