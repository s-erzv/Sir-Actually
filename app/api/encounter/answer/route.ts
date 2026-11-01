/**
 * POST /api/encounter/answer
 *
 * Runs the full Judge pipeline for one player answer:
 *   1. DummyLLMProvider.judgeAnswer (M2; replaced by real LLM in M4)
 *   2. validateQuotes
 *   3. applyRules
 *   4. computeDamage + computeHeartLoss
 *
 * Returns EvaluationResult plus updated encounter state.
 */

import { NextRequest, NextResponse } from "next/server";
import type { WeaknessType, EvaluationResult, EncounterStatus } from "@/lib/domain/types";
import { getLLMProviderForBoss } from "@/lib/llm";
import { validateQuotes } from "@/lib/judge/validateQuotes";
import { applyRules } from "@/lib/judge/rules";
import { computeDamage, computeHeartLoss } from "@/lib/judge/damage";
import { RUBRICS, getScoreMax } from "@/lib/rubrics";
import { BOSS_HP, MINION_HP, MAX_QUESTIONS_PER_ROOM, HEARTS_START } from "@/lib/balance";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface AnswerRequest {
  encounterId: string;
  findingId: string;
  weaknessType: WeaknessType;
  bossSlug?: string;
  answer: string;
  evidenceQuote?: string;
  isBoss: boolean;
  /** Current HP of the boss/minion before this answer. */
  hp: number;
  /** Current Hearts before this answer. */
  hearts: number;
  /** Number of questions already asked (0-indexed). */
  questionsAsked: number;
  /** Full manuscript source text (for rules engine). */
  sourceText: string;
  /** Known citation raw_text values (for unsupported_citation rule). */
  knownCitations: string[];
}

interface AnswerResponse {
  evaluation: EvaluationResult;
  newHp: number;
  newHearts: number;
  encounterStatus: EncounterStatus;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AnswerRequest;
  try {
    body = (await req.json()) as AnswerRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    weaknessType,
    bossSlug,
    answer,
    evidenceQuote,
    isBoss,
    hp,
    hearts,
    questionsAsked,
    sourceText,
    knownCitations,
  } = body;

  const rubricCriteria = RUBRICS[weaknessType];
  if (!rubricCriteria) {
    return NextResponse.json(
      { error: `Unknown weaknessType: ${weaknessType}` },
      { status: 400 },
    );
  }

  const rubricIds = rubricCriteria.map((c) => c.id);
  const scoreMax = getScoreMax(weaknessType);
  const hpMax = isBoss ? BOSS_HP : MINION_HP;

  // Step 1: LLM Judge — boss slug routes to its Kagiro model.
  const provider = getLLMProviderForBoss(bossSlug);
  const rawOutput = await provider.judgeAnswer({
    playerAnswer: answer,
    evidenceQuote: evidenceQuote ?? "",
    weaknessType,
    rubricCriteria,
    previousQuestions: [],
  });

  // Step 2: Validate quotes
  const validated = validateQuotes(rawOutput, answer, rubricIds);

  // Step 3: Apply deterministic rules
  const { scores, caps } = applyRules(validated, {
    playerAnswer: answer,
    sourceText,
    weaknessType,
    knownCitations,
  });

  // Step 4: Compute damage and Heart loss
  const scoreTotal = scores.reduce((sum, s) => sum + s.level, 0);
  const damage = computeDamage(scoreTotal, scoreMax, isBoss, hpMax);
  const heartLost = computeHeartLoss(scoreTotal);

  // Step 5: Update encounter state
  const newHp = Math.max(0, hp - damage);
  const newHearts = heartLost ? Math.max(0, hearts - 1) : hearts;
  const newQuestionsAsked = questionsAsked + 1;

  let encounterStatus: EncounterStatus;
  if (newHp <= 0) {
    encounterStatus = "won";
  } else if (newHearts <= 0) {
    encounterStatus = "lost";
  } else if (newQuestionsAsked >= MAX_QUESTIONS_PER_ROOM) {
    encounterStatus = "conceded";
  } else {
    encounterStatus = "active";
  }

  const evaluation: EvaluationResult = {
    scores,
    scoreTotal,
    scoreMax,
    damage,
    heartLost,
    missing: rawOutput.missing,
    ruleCaps: caps,
  };

  const response: AnswerResponse = {
    evaluation,
    newHp,
    newHearts,
    encounterStatus,
  };

  return NextResponse.json(response);
}
