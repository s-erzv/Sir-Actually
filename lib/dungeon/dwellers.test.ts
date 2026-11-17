import { describe, expect, it } from "vitest";
import { buildFloorPlan } from "@/game/map/buildFloorPlan";
import { generateFloorFromPlan } from "@/game/map/generateFloor";
import { TileCode, isSolid } from "@/game/map/tiles";
import type { FindingStub, FloorMap, WeaknessType } from "@/lib/domain/types";
import { DWELLER_ROOM_BASE, dwellerCount, eligibleClaims, placeDwellers } from "./dwellers";

function methodFloor(count: number, seed = 20261101): FloorMap {
  const types: WeaknessType[] = ["rq_method_mismatch", "sample_unreported", "limitation_missing"];
  const findings: FindingStub[] = Array.from({ length: count }, (_, index) => ({
    id: `f${index}`,
    weaknessType: types[index % types.length]!,
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: "kutipan",
    floor: 1,
    rank: index + 1,
  }));
  return generateFloorFromPlan(buildFloorPlan(findings, true)[0]!, seed);
}

describe("dwellerCount", () => {
  it("mengisi lantai sampai target min(3 + lantai, 7)", () => {
    expect(dwellerCount({ floorOrder: 1, dimension: "method", findingCount: 2, claimCount: 9 })).toBe(2);
    expect(dwellerCount({ floorOrder: 4, dimension: "audit", findingCount: 3, claimCount: 9 })).toBe(4);
  });

  it("tidak pernah negatif saat temuan sudah banyak", () => {
    expect(dwellerCount({ floorOrder: 1, dimension: "method", findingCount: 9, claimCount: 9 })).toBe(0);
  });

  it("tidak melebihi jumlah klaim yang bisa ditanyakan", () => {
    expect(dwellerCount({ floorOrder: 3, dimension: "gap", findingCount: 1, claimCount: 2 })).toBe(2);
    expect(dwellerCount({ floorOrder: 3, dimension: "gap", findingCount: 1, claimCount: 0 })).toBe(0);
  });

  it("Ghost dan Takhta tidak punya penghuni", () => {
    expect(dwellerCount({ floorOrder: 5, dimension: "ghost", findingCount: 0, claimCount: 9 })).toBe(0);
    expect(dwellerCount({ floorOrder: 6, dimension: "throne", findingCount: 0, claimCount: 9 })).toBe(0);
  });
});

describe("eligibleClaims", () => {
  const claims = [
    { kind: "method", source_quote: "Sampel berjumlah 45 mahasiswa." },
    { kind: "conclusion", source_quote: "Media sosial menurunkan prestasi." },
    { kind: "method", source_quote: "pendek" },
    { kind: "rq", source_quote: "Bagaimana hubungan keduanya di kampus ini?" },
  ];

  it("hanya klaim dari dimensi lantai yang punya kutipan naskah", () => {
    expect(eligibleClaims(claims, "method").map((claim) => claim.kind)).toEqual(["method", "rq"]);
    expect(eligibleClaims(claims, "audit").map((claim) => claim.kind)).toEqual(["conclusion"]);
    expect(eligibleClaims(claims, "ghost")).toEqual([]);
  });
});

describe("placeDwellers", () => {
  const map = methodFloor(3);

  it("lantai menyediakan pos penghuni di persimpangan lorong", () => {
    expect(map.dwellerSpots!.length).toBeGreaterThanOrEqual(3);
    for (const spot of map.dwellerSpots!) {
      const code = map.tiles[spot.y]![spot.x] as TileCode;
      expect(isSolid(code)).toBe(false);
      const inRoom = map.rooms.some(
        (room) =>
          spot.x >= room.rect.x &&
          spot.x < room.rect.x + room.rect.width &&
          spot.y >= room.rect.y &&
          spot.y < room.rect.y + room.rect.height,
      );
      expect(inRoom).toBe(false);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const near = map.tiles[spot.y + dy]?.[spot.x + dx];
        expect(near === TileCode.DOOR_OPEN || near === TileCode.DOOR_LOCKED).toBe(false);
      }
    }
  });

  it("pos tidak menimpa monster, jarahan jalan buntu, tangga, atau titik awal", () => {
    const taken = new Set([
      `${map.playerSpawn.x},${map.playerSpawn.y}`,
      `${map.stairs.x},${map.stairs.y}`,
      ...map.rooms.map((room) => `${room.monsterSpawn.x},${room.monsterSpawn.y}`),
      ...(map.deadEnds ?? []).map((tip) => `${tip.x},${tip.y}`),
    ]);
    for (const spot of map.dwellerSpots!) expect(taken.has(`${spot.x},${spot.y}`)).toBe(false);
  });

  it("menempatkan sejumlah yang diminta dengan id, level, dan nomor ruang stabil", () => {
    const dwellers = placeDwellers(map, 2);
    expect(dwellers.map((dweller) => dweller.id)).toEqual(["f1-d0", "f1-d1"]);
    expect(dwellers.map((dweller) => dweller.roomOrder)).toEqual([DWELLER_ROOM_BASE, DWELLER_ROOM_BASE + 1]);
    expect(dwellers.every((dweller) => dweller.level === 1)).toBe(true);
    expect(placeDwellers(map, 2)).toEqual(dwellers);
  });

  it("nol penghuni tetap sah, dan tidak pernah melebihi pos yang ada", () => {
    expect(placeDwellers(map, 0)).toEqual([]);
    expect(placeDwellers(map, 99).length).toBe(map.dwellerSpots!.length);
  });

  it("nomor ruang penghuni tidak bertabrakan dengan ruang temuan", () => {
    const big = methodFloor(14);
    expect(big.rooms.length).toBeLessThan(DWELLER_ROOM_BASE);
  });
});
