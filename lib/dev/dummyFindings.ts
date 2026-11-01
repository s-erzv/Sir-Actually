import type { FindingStub, FloorMap } from "@/lib/domain/types";
import { generateFloor } from "@/game/map/generateFloor";

/**
 * Dummy findings for M1–M3 development.
 * Replaced by real Recon findings in M4.
 */
export const DUMMY_FINDINGS: FindingStub[] = [
  {
    id: "f1-gap",
    weaknessType: "gap_unsupported",
    severity: 2,
    centrality: 2,
    confidence: 0.85,
    evidenceQuote: "The research gap is claimed but no supporting literature is cited.",
    floor: 1,
    rank: 1,
  },
  {
    id: "f1-cite",
    weaknessType: "claim_without_citation",
    severity: 2,
    centrality: 3,
    confidence: 0.9,
    evidenceQuote: "Studies show significant improvement (p < 0.05) without citing a source.",
    floor: 1,
    rank: 2,
  },
  {
    id: "f1-obj",
    weaknessType: "problem_objective_gap",
    severity: 3,
    centrality: 3,
    confidence: 0.75,
    evidenceQuote: "The stated problem does not match the declared research objectives.",
    floor: 1,
    rank: 3,
  },
  {
    id: "f2-sample",
    weaknessType: "sample_unreported",
    severity: 2,
    centrality: 2,
    confidence: 0.8,
    evidenceQuote: "Sample size is not reported in the methodology section.",
    floor: 2,
    rank: 1,
  },
  {
    id: "f2-overc",
    weaknessType: "conclusion_overclaim",
    severity: 3,
    centrality: 3,
    confidence: 0.88,
    evidenceQuote: "The conclusion generalises findings beyond the sample population.",
    floor: 2,
    rank: 2,
  },
];

export const DUMMY_FLOOR_SEED = 20241030;

export function buildDummyFloor(floorOrder: 1 | 2): FloorMap {
  return generateFloor(
    DUMMY_FINDINGS.filter((f) => f.floor === floorOrder),
    floorOrder,
    DUMMY_FLOOR_SEED,
  );
}
