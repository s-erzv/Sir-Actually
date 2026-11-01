import mitt from "mitt";
import type { WeaknessType } from "@/lib/domain/types";

/** Events emitted between Phaser and React via the shared bus. */
export type GameEvents = {
  /** Phaser → React: player walked into a monster/encounter trigger. */
  "encounter:start": {
    encounterId: string;
    findingId: string;
    bossSlug: string;
    floor: number;
    room: number;
    weaknessType?: WeaknessType;
    evidenceQuote?: string;
  };
  /** React → Phaser: player finished (or skipped) the encounter. */
  "encounter:end": {
    encounterId: string;
    result: "won" | "conceded" | "disputed" | "fled";
  };
  /** Phaser → React: player tried to walk through a locked door. */
  "door:locked": {
    doorTileX: number;
    doorTileY: number;
  };
  /** Internal: a door should now be unlocked in the tilemap. */
  "door:unlock": {
    doorTileX: number;
    doorTileY: number;
  };
  /** React → Phaser: boss takes a hit (triggers shake + damage number). */
  "boss:hit": {
    encounterId: string;
    damage: number;
  };
  /** React → Phaser: retry the current floor (from Kitab Nasihat). */
  "floor:retry": undefined;
  /** Phaser → React: reset hearts (used after floor:retry). */
  "hearts:reset": undefined;
};

export const bus = mitt<GameEvents>();
