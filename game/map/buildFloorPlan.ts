import type {
  DungeonDimension,
  DungeonTier,
  FindingStub,
  FloorPlan,
  ResearchDimension,
  RoomPlan,
  WeaknessType,
} from "@/lib/domain/types";
import { LOW_CONFIDENCE } from "@/lib/balance";

export const MONSTERS_PER_ROOM_MAX = 1;

export const RESEARCH_DIMENSIONS: readonly ResearchDimension[] = [
  "gap",
  "align",
  "method",
  "audit",
] as const;

export const BOSS_BY_DIMENSION: Record<DungeonDimension, string> = {
  gap: "veylith",
  align: "draeven",
  method: "kryvax",
  audit: "morvane",
  ghost: "nyxara",
  throne: "eldravos",
};

export const WEAKNESS_DIMENSION: Record<WeaknessType, DungeonDimension> = {
  gap_unsupported: "gap",
  gap_answered_by_own_refs: "gap",
  claim_without_citation: "gap",
  problem_objective_gap: "align",
  objective_rq_mismatch: "align",
  rq_method_mismatch: "method",
  sample_unreported: "method",
  generalization_beyond_sample: "method",
  limitation_missing: "method",
  conclusion_overclaim: "audit",
  objective_without_finding: "audit",
  abstract_result_mismatch: "audit",
  citation_not_found: "ghost",
  citation_claim_mismatch: "ghost",
};

function dimensionOf(finding: FindingStub): DungeonDimension {
  return WEAKNESS_DIMENSION[finding.weaknessType] ?? "audit";
}

function isResearchDimension(
  dimension: DungeonDimension,
): dimension is ResearchDimension {
  return RESEARCH_DIMENSIONS.includes(dimension as ResearchDimension);
}

function compareFindings(a: FindingStub, b: FindingStub): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.severity !== b.severity) return b.severity - a.severity;
  if (a.centrality !== b.centrality) return b.centrality - a.centrality;
  if (a.confidence !== b.confidence) return b.confidence - a.confidence;
  return a.id.localeCompare(b.id);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function isOptional(monsters: readonly FindingStub[]): boolean {
  return monsters.length > 0 && monsters.every((monster) => monster.confidence < LOW_CONFIDENCE);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function orderDimensions(
  groups: Map<ResearchDimension, FindingStub[]>,
): ResearchDimension[] {
  return [...groups.keys()].sort((a, b) => {
    const groupA = groups.get(a) ?? [];
    const groupB = groups.get(b) ?? [];
    const severityA = average(groupA.map((finding) => finding.severity));
    const severityB = average(groupB.map((finding) => finding.severity));
    if (severityA !== severityB) return severityA - severityB;

    const centralityA = average(groupA.map((finding) => finding.centrality));
    const centralityB = average(groupB.map((finding) => finding.centrality));
    if (centralityA !== centralityB) return centralityA - centralityB;

    const fixedA = RESEARCH_DIMENSIONS.indexOf(a);
    const fixedB = RESEARCH_DIMENSIONS.indexOf(b);
    return fixedA - fixedB;
  });
}

function buildResearchFloor(
  dimension: ResearchDimension,
  findings: readonly FindingStub[],
  floorOrder: number,
): FloorPlan {
  const sorted = [...findings].sort(compareFindings);
  const boss = sorted[0]!;
  const minions = sorted.slice(1).sort((a, b) => b.rank - a.rank);

  const monsterRooms: RoomPlan[] = chunk(minions, MONSTERS_PER_ROOM_MAX).map((room) => ({
    kind: "minions",
    monsterIds: room.map((monster) => monster.id),
    optional: isOptional(room),
  }));

  monsterRooms.push({
    kind: "boss",
    monsterIds: [boss.id],
    optional: false,
  });

  return {
    floorOrder,
    dimension,
    bossSlug: BOSS_BY_DIMENSION[dimension],
    rooms: monsterRooms,
    findingIds: sorted.map((finding) => finding.id),
    monsterCount: sorted.length,
  };
}

function buildSpecialFloor(
  dimension: "ghost" | "throne",
  floorOrder: number,
  focusFindingId?: string,
): FloorPlan {
  return {
    floorOrder,
    dimension,
    bossSlug: BOSS_BY_DIMENSION[dimension],
    rooms: [{ kind: "special", monsterIds: [], optional: false }],
    findingIds: [],
    monsterCount: 1,
    ...(dimension === "throne" && focusFindingId ? { focusFindingId } : {}),
  };
}

export function getDungeonTier(findings: readonly FindingStub[]): DungeonTier {
  const research = findings.filter((finding) => isResearchDimension(dimensionOf(finding)));
  const dimensions = new Set(research.map(dimensionOf));
  const severityThree = research.filter((finding) => finding.severity === 3).length;

  if (dimensions.size >= 4 || severityThree >= 2) return "rapuh";
  if (dimensions.size >= 2 || severityThree >= 1) return "retak";
  return "kokoh";
}

export function buildFloorPlan(
  findings: readonly FindingStub[],
  hasReferences: boolean,
): FloorPlan[] {
  const groups = new Map<ResearchDimension, FindingStub[]>();
  for (const finding of findings) {
    const dimension = dimensionOf(finding);
    if (!isResearchDimension(dimension)) continue;
    const group = groups.get(dimension) ?? [];
    group.push(finding);
    groups.set(dimension, group);
  }

  const researchDimensions = orderDimensions(groups);
  const floors: FloorPlan[] = researchDimensions.map((dimension, index) =>
    buildResearchFloor(dimension, groups.get(dimension) ?? [], index + 1),
  );

  let nextFloor = floors.length + 1;
  if (hasReferences) {
    floors.push(buildSpecialFloor("ghost", nextFloor));
    nextFloor += 1;
  }

  const focusFindingId = [...findings]
    .filter((finding) => isResearchDimension(dimensionOf(finding)))
    .sort(compareFindings)[0]?.id;

  floors.push(buildSpecialFloor("throne", nextFloor, focusFindingId));
  return floors;
}
