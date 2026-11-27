/**
 * One exchange: the player's answer becomes a strike, and a weak answer lets
 * the monster strike back. Pure; the route persists the result.
 *
 * Strike power = base + evidence bonus + bought weapon, times answer quality,
 * plus the character's skill. A counter-attack hits the armor's shield first.
 */

import type { AttackStyle, CombatOutcome, Quality } from "@/lib/domain/types";
import {
  ATTACK_BASE,
  COUNTER_BY_QUALITY,
  EVIDENCE_POWER,
  PASSIVE_DAMAGE_MAX,
  QUALITY_MULTIPLIER,
} from "@/lib/balance";
import { hasSixWordQuote } from "@/lib/loadout";
import { qualityLabel } from "./quality";
import { absorbHit } from "./shop";

/** How each character's strike looks in the dungeon. */
export const CHARACTER_STYLE: Record<string, AttackStyle> = {
  arka: "sword",
  mira: "bow",
  sena: "shield",
  kiran: "bow",
  vara: "axe",
};

export interface StrikeContext {
  answer: string;
  sourceText: string;
  citations: readonly string[];
  /** Monster HP before this strike, as a share of its maximum. */
  enemyHpRatio: number;
  firstAnswer: boolean;
}

/** Each character's one skill: a small flat bonus on a hit that landed. */
function skillDamage(characterSlug: string, ctx: StrikeContext): number {
  if (characterSlug === "arka" && ctx.firstAnswer) return 3;
  if (characterSlug === "kiran" && hasSixWordQuote(ctx.answer, ctx.sourceText)) return 2;
  if (characterSlug === "vara" && ctx.enemyHpRatio <= 0.3) return 3;
  return 0;
}

export interface ResolveInput extends StrikeContext {
  characterSlug: string;
  quality: Quality;
  usedEvidence: boolean;
  monsterAttack: number;
  /** Bought weapon, if any. */
  weapon?: { slug: string; name: string; power: number } | null;
  /** Shield left on the equipped armor; 0 without armor. */
  shield?: number;
  /** Answers too short to judge are not punished. */
  tooShort?: boolean;
}

export function resolveCombat(input: ResolveInput): CombatOutcome {
  const power = ATTACK_BASE + (input.usedEvidence ? EVIDENCE_POWER : 0) + Math.max(0, input.weapon?.power ?? 0);

  let damage = Math.round(power * QUALITY_MULTIPLIER[input.quality]);
  if (damage > 0) {
    damage += Math.min(PASSIVE_DAMAGE_MAX, skillDamage(input.characterSlug, input));
  }

  const counter = input.tooShort ? 0 : Math.round(input.monsterAttack * COUNTER_BY_QUALITY[input.quality]);
  const hit = absorbHit(counter, input.shield ?? 0);

  return {
    quality: input.quality,
    qualityLabel: qualityLabel(input.quality),
    usedEvidence: input.usedEvidence,
    weaponSlug: input.weapon?.slug ?? "none",
    weaponName: input.weapon?.name ?? "Tangan kosong",
    weaponKind: input.usedEvidence ? "signature" : "basic",
    attackStyle: CHARACTER_STYLE[input.characterSlug] ?? "sword",
    damage,
    counterDamage: hit.hpLoss,
    absorbed: hit.absorbed,
    armorBroken: hit.broken,
    shielded: counter > 0 && hit.hpLoss === 0,
  };
}
