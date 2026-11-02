import { describe, expect, it } from "vitest";
import {
  BOSS_BY_DIMENSION,
  MONSTERS_PER_ROOM_MAX,
  buildFloorPlan,
  getDungeonTier,
} from "./buildFloorPlan";
import type { FindingStub, WeaknessType } from "@/lib/domain/types";

let nextId = 0;

function finding(
  weaknessType: WeaknessType,
  rank: number,
  overrides: Partial<FindingStub> = {},
): FindingStub {
  nextId += 1;
  return {
    id: `finding-${nextId}`,
    weaknessType,
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: `quote ${nextId}`,
    floor: 1,
    rank,
    ...overrides,
  };
}

function allMonsterIds(floors: ReturnType<typeof buildFloorPlan>): string[] {
  return floors.flatMap((floor) => floor.rooms.flatMap((room) => room.monsterIds));
}

describe("buildFloorPlan", () => {
  it("always adds throne, and ghost only when references exist", () => {
    const withRefs = buildFloorPlan([], true);
    expect(withRefs.map((floor) => floor.dimension)).toEqual(["ghost", "throne"]);
    expect(withRefs[0]!.bossSlug).toBe(BOSS_BY_DIMENSION.ghost);
    expect(withRefs[1]!.bossSlug).toBe(BOSS_BY_DIMENSION.throne);

    const withoutRefs = buildFloorPlan([], false);
    expect(withoutRefs.map((floor) => floor.dimension)).toEqual(["throne"]);
  });

  it("makes a single finding the boss, with no minion room", () => {
    const only = finding("gap_unsupported", 1);
    const floors = buildFloorPlan([only], true);
    const gap = floors.find((floor) => floor.dimension === "gap")!;

    expect(gap.rooms).toHaveLength(1);
    expect(gap.rooms[0]!.kind).toBe("boss");
    expect(gap.rooms[0]!.monsterIds).toEqual([only.id]);
    expect(gap.monsterCount).toBe(1);
  });

  it("spreads every non-boss finding into its own room, boss last", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding("sample_unreported", index + 1),
    );
    const floors = buildFloorPlan(findings, true);
    const method = floors.find((floor) => floor.dimension === "method")!;

    expect(method.monsterCount).toBe(7);
    expect(method.rooms).toHaveLength(7);
    expect(method.rooms.every((room, index) =>
      index === method.rooms.length - 1
        ? room.kind === "boss"
        : room.kind === "minions" && room.monsterIds.length === MONSTERS_PER_ROOM_MAX
    )).toBe(true);
    expect(method.rooms.at(-1)!.monsterIds).toEqual([findings[0]!.id]);
  });

  it("uses the lowest rank number as boss", () => {
    const boss = finding("sample_unreported", 1, { severity: 3 });
    const minions = [2, 3, 4].map((rank) => finding("sample_unreported", rank));
    const method = buildFloorPlan([...minions, boss], true).find(
      (floor) => floor.dimension === "method",
    )!;

    const bossRoom = method.rooms.at(-1)!;
    expect(bossRoom.monsterIds).toEqual([boss.id]);
  });

  it("orders research floors by average severity, then centrality", () => {
    const gap = finding("gap_unsupported", 1, { severity: 1, centrality: 3 });
    const audit = finding("conclusion_overclaim", 2, { severity: 2, centrality: 2 });
    const method = finding("sample_unreported", 3, { severity: 3, centrality: 1 });

    const floors = buildFloorPlan([method, audit, gap], true);
    expect(floors.map((floor) => floor.dimension)).toEqual([
      "gap",
      "audit",
      "method",
      "ghost",
      "throne",
    ]);
    expect(floors.map((floor) => floor.floorOrder)).toEqual([1, 2, 3, 4, 5]);
  });

  it("assigns every research finding exactly once", () => {
    const findings = [
      finding("gap_unsupported", 1),
      finding("claim_without_citation", 2),
      finding("objective_rq_mismatch", 3),
      finding("rq_method_mismatch", 4),
      finding("sample_unreported", 5),
      finding("limitation_missing", 6),
      finding("conclusion_overclaim", 7),
      finding("abstract_result_mismatch", 8),
    ];
    const floors = buildFloorPlan(findings, true);
    const ids = allMonsterIds(floors);
    const researchIds = floors
      .filter((floor) => floor.dimension !== "ghost" && floor.dimension !== "throne")
      .flatMap((floor) => floor.findingIds);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(researchIds)).toEqual(new Set(findings.map((item) => item.id)));
  });

  it("does not turn citation findings into research floor monsters", () => {
    const citation = finding("citation_not_found", 1);
    const floors = buildFloorPlan([citation], true);
    expect(floors.map((floor) => floor.dimension)).toEqual(["ghost", "throne"]);
    expect(allMonsterIds(floors)).toEqual([]);
  });

  it("marks a room optional only when all its monsters are low-confidence", () => {
    const boss = finding("sample_unreported", 1, { confidence: 0.9 });
    const low = [2, 3, 4].map((rank) =>
      finding("sample_unreported", rank, { confidence: 0.4 }),
    );
    const method = buildFloorPlan([boss, ...low], true).find(
      (floor) => floor.dimension === "method",
    )!;

    const minionRoom = method.rooms.find((room) => room.kind === "minions")!;
    const bossRoom = method.rooms.find((room) => room.kind === "boss")!;
    expect(minionRoom.optional).toBe(true);
    expect(bossRoom.optional).toBe(false);
  });

  it("is deterministic", () => {
    const findings = [
      finding("gap_unsupported", 2, { severity: 1 }),
      finding("conclusion_overclaim", 1, { severity: 3 }),
      finding("sample_unreported", 3, { severity: 2 }),
    ];
    expect(buildFloorPlan(findings, true)).toEqual(buildFloorPlan(findings, true));
  });

  it("caps at six floors: four research dimensions plus ghost and throne", () => {
    const floors = buildFloorPlan(
      [
        finding("gap_unsupported", 1),
        finding("objective_rq_mismatch", 2),
        finding("sample_unreported", 3),
        finding("conclusion_overclaim", 4),
      ],
      true,
    );
    expect(floors).toHaveLength(6);
    expect(floors.at(-1)!.dimension).toBe("throne");
  });
});

describe("getDungeonTier", () => {
  it("returns kokoh for zero or one calm dimension", () => {
    expect(getDungeonTier([])).toBe("kokoh");
    expect(getDungeonTier([finding("gap_unsupported", 1, { severity: 2 })])).toBe("kokoh");
  });

  it("returns retak for two dimensions or one severity-3 finding", () => {
    expect(
      getDungeonTier([
        finding("gap_unsupported", 1, { severity: 1 }),
        finding("sample_unreported", 2, { severity: 2 }),
      ]),
    ).toBe("retak");
    expect(getDungeonTier([finding("gap_unsupported", 1, { severity: 3 })])).toBe("retak");
  });

  it("returns rapuh for four dimensions or two severity-3 findings", () => {
    expect(
      getDungeonTier([
        finding("gap_unsupported", 1),
        finding("objective_rq_mismatch", 2),
        finding("sample_unreported", 3),
        finding("conclusion_overclaim", 4),
      ]),
    ).toBe("rapuh");
    expect(
      getDungeonTier([
        finding("gap_unsupported", 1, { severity: 3 }),
        finding("sample_unreported", 2, { severity: 3 }),
      ]),
    ).toBe("rapuh");
  });
});
