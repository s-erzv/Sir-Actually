import mitt from "mitt";
import type { WeaknessType } from "@/lib/domain/types";

/** Events emitted between Phaser and React via the shared bus. */
export type GameEvents = {
  /** Phaser → React: player walked into a monster/encounter trigger. */
  "encounter:start": {
    encounterId: string;
    encounterKey: string;
    findingId: string;
    bossSlug: string;
    floor: number;
    room: number;
    isBoss?: boolean;
    weaknessType?: WeaknessType;
    evidenceQuote?: string;
  };
  /** React → Phaser: player finished (or skipped) the encounter. */
  "encounter:end": {
    encounterId: string;
    encounterKey?: string;
    result: "won" | "conceded" | "disputed" | "fled";
  };
  /** Phaser → React: player tried to walk through a locked door. */
  "door:locked": {
    doorTileX: number;
    doorTileY: number;
  };
  /** Phaser → React: a cleared room opened the door to the next one. */
  "door:opened": { roomNumber: number };
  /** Phaser → React: monsters left in the room the player must clear next. */
  "room:progress": { roomNumber: number; remaining: number; total: number } | null;
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
  /** Phaser → React: player reached the stairs and every monster is resolved. */
  "stairs:reach": {
    floor: number;
  };
  /** React → Phaser: retry the current floor (from Kitab Nasihat). */
  "floor:retry": undefined;
  /** Phaser → React: reset hearts (used after floor:retry). */
  "hearts:reset": undefined;
  /** React → Phaser: lock movement while a full-screen game overlay is open. */
  "game:pause": undefined;
  /** React → Phaser: unlock movement after the overlay closes. */
  "game:resume": undefined;
  /** React → Phaser: zoom the dungeon camera in/out. */
  "camera:zoom": { delta: number };
};

export const bus = mitt<GameEvents>();
