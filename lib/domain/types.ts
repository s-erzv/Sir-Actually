/**
 * Core domain types shared across game logic, React UI, and server code.
 * No Phaser imports here — this file must be importable in Node/Vitest.
 */

// ---------------------------------------------------------------------------
// Finding (stub for M1; replaced by real DB type in M4)
// ---------------------------------------------------------------------------

export type WeaknessType =
  | "gap_unsupported"
  | "gap_answered_by_own_refs"
  | "claim_without_citation"
  | "problem_objective_gap"
  | "objective_rq_mismatch"
  | "rq_method_mismatch"
  | "sample_unreported"
  | "generalization_beyond_sample"
  | "limitation_missing"
  | "conclusion_overclaim"
  | "objective_without_finding"
  | "abstract_result_mismatch"
  | "citation_not_found"
  | "citation_claim_mismatch";

export type Floor = 1 | 2 | 3 | 4;

export interface FindingStub {
  id: string;
  weaknessType: WeaknessType;
  /** 1=low … 3=high */
  severity: 1 | 2 | 3;
  /** 1=peripheral … 3=central */
  centrality: 1 | 2 | 3;
  confidence: number;
  evidenceQuote: string;
  /** Which dungeon floor this finding belongs to (1–4). */
  floor: Floor;
  rank: number;
}

// ---------------------------------------------------------------------------
// Floor map
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  /** Corresponding finding id (null for empty/connector rooms). */
  findingId: string | null;
  rect: Rect;
  /** True if this is the floor's boss room (last room, largest). */
  isBoss: boolean;
  /** Tile coordinate where the monster/boss spawns. */
  monsterSpawn: Vec2;
  /** Door tile that locks this room's entrance (null for first room). */
  entranceDoor: Vec2 | null;
}

export interface FindingMeta {
  weaknessType: WeaknessType;
  evidenceQuote: string;
}

export interface FloorMap {
  floorOrder: Floor;
  /** 2D array of TileCode values; tiles[row][col]. */
  tiles: number[][];
  rooms: Room[];
  playerSpawn: Vec2;
  /** Tile position of the stairs leading to the next floor. */
  stairs: Vec2;
  /** Total tile width of the map. */
  width: number;
  /** Total tile height of the map. */
  height: number;
  findingMeta?: Record<string, FindingMeta>;
}

// ---------------------------------------------------------------------------
// Judge pipeline types (M2+)
// ---------------------------------------------------------------------------

/** A single scoring criterion in a rubric. */
export interface RubricCriterion {
  id: string;
  label: string;
}

/** One criterion score as returned by the LLM Judge (raw, before validation). */
export interface JudgeCriterionOutput {
  id: string;
  level: 0 | 1 | 2;
  /** Substring of the player's answer that justifies the level. */
  quote: string;
}

/** Full output of the LLM Judge. Only JSON, validated by zod in M4. */
export interface JudgeRawOutput {
  criteria: JudgeCriterionOutput[];
  /** One sentence describing what is still missing, quoting the player's answer. */
  missing: string;
}

/** A validated + possibly capped criterion score. */
export interface ValidatedScore {
  criterionId: string;
  level: 0 | 1 | 2;
  /** The quote from the player's answer (empty string if invalid/missing). */
  quote: string;
  /** True if a rule cap was applied to lower this level. */
  capApplied: boolean;
}

/** Record of one deterministic rule that capped a criterion level. */
export interface RuleCap {
  criterionId: string;
  cappedTo: 0 | 1;
  reason: string;
}

/** Final output of the Judge pipeline for one player answer. */
export interface EvaluationResult {
  scores: ValidatedScore[];
  scoreTotal: number;
  scoreMax: number;
  damage: number;
  heartLost: boolean;
  missing: string;
  ruleCaps: RuleCap[];
}

// ---------------------------------------------------------------------------
// Encounter runtime state (M2+, stored in React state until M3 DB)
// ---------------------------------------------------------------------------

export type EncounterStatus =
  | "active"
  | "won"
  | "conceded"
  | "lost"
  | "disputed";

export interface EncounterState {
  encounterId: string;
  findingId: string;
  bossSlug: string;
  isBoss: boolean;
  hp: number;
  hpMax: number;
  hearts: number;
  questionsAsked: number;
  status: EncounterStatus;
  /** Evaluation from the most recent answer (null before first answer). */
  lastEvaluation: EvaluationResult | null;
}
