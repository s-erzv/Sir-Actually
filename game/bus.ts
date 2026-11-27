import mitt from "mitt";
import type { AttackStyle, EncounterTopic, Quality } from "@/lib/domain/types";

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
    /** A finding's weakness type, or "comprehension" for a dweller. */
    weaknessType?: EncounterTopic;
    /** Finding severity, used only to derive the monster level on screen. */
    severity?: number;
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
  /** Phaser → React: player picked up loot; bank the stable key on the server. */
  "loot:collected": { key: string };
  /** Phaser → React: player entered a new tile (fog of war). */
  "player:moved": { x: number; y: number };
  /** Phaser → React: monsters left in the room the player must clear next. */
  "room:progress": { roomNumber: number; remaining: number; total: number } | null;
  /** Internal: a door should now be unlocked in the tilemap. */
  "door:unlock": {
    doorTileX: number;
    doorTileY: number;
  };
  /**
   * React → Phaser: one exchange to play back. `damage` goes to the monster,
   * `counterDamage` comes back at the player. Fields beyond encounterId and
   * damage are optional so older callers keep working.
   */
  "boss:hit": {
    encounterId: string;
    damage: number;
    /** Answer quality 0-5; decides how big the hit reads. */
    quality?: Quality;
    qualityLabel?: string;
    attackStyle?: AttackStyle;
    weaponName?: string;
    weaponKind?: "basic" | "signature";
    counterDamage?: number;
    shielded?: boolean;
    /** Monster HP after the strike, for the in-world bar. */
    monsterHp?: number;
    monsterHpMax?: number;
    /** The exchange emptied a whole Heart. */
    heartLost?: boolean;
  };
  /** Phaser → React: player talked to this floor's merchant. */
  "shop:open": { floor: number };
  /** React → Phaser: a potion was drunk; play the heal effect. */
  "potion:used": { healed: number };
  /** Phaser → React: player reached the stairs and every monster is resolved. */
  "stairs:reach": {
    floor: number;
  };
  /** React → Phaser: one D-pad step. */
  "player:step": { dir: "up" | "down" | "left" | "right" };
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
