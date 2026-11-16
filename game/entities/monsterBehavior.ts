import type { Vec2 } from "@/lib/domain/types";

export type MonsterBehavior = "hunter" | "sentinel" | "ambusher";

const ROLES: readonly MonsterBehavior[] = ["hunter", "sentinel", "ambusher"];

export const MONSTER_BEHAVIORS = {
  hunter: {
    activationRange: Number.POSITIVE_INFINITY,
    moveDuration: 170,
    dormantMarker: "!",
    activeMarker: "!",
    dormantColor: "#ffdd44",
    activeColor: "#ffdd44",
  },
  sentinel: {
    activationRange: 5,
    moveDuration: 260,
    dormantMarker: "◇",
    activeMarker: "◆",
    dormantColor: "#7dd3fc",
    activeColor: "#38bdf8",
  },
  ambusher: {
    activationRange: 2,
    moveDuration: 105,
    dormantMarker: "?",
    activeMarker: "!",
    dormantColor: "#d8b4fe",
    activeColor: "#f0abfc",
  },
} as const satisfies Record<MonsterBehavior, {
  activationRange: number;
  moveDuration: number;
  dormantMarker: string;
  activeMarker: string;
  dormantColor: string;
  activeColor: string;
}>;

export function behaviorForSpawn(isBoss: boolean, monsterIndex: number): MonsterBehavior {
  if (isBoss) return "hunter";
  return ROLES[monsterIndex % ROLES.length]!;
}

export function shouldChase(
  behavior: MonsterBehavior,
  monsterTile: Vec2,
  playerTile: Vec2,
  insideRoom: boolean,
): boolean {
  if (!insideRoom) return false;
  const distance = Math.abs(monsterTile.x - playerTile.x) + Math.abs(monsterTile.y - playerTile.y);
  return distance <= MONSTER_BEHAVIORS[behavior].activationRange;
}
