/**
 * One exchange: the player's answer becomes a weapon strike, and a weak
 * answer lets the monster strike back. Pure; the route persists the result.
 */

import type { AttackStyle, CombatOutcome, Quality } from "@/lib/domain/types";
import {
  COUNTER_BY_QUALITY,
  PASSIVE_DAMAGE_MAX,
  QUALITY_MULTIPLIER,
  WEAPON_POWER,
} from "@/lib/balance";
import {
  getCharacter,
  getWeapon,
  hasSixWordQuote,
  mentionsCitation,
  mentionsLimitation,
  mentionsSourceNumber,
  type WeaponSlug,
} from "@/lib/loadout";
import { qualityLabel } from "./quality";

interface Arsenal {
  signature: WeaponSlug;
  basic: WeaponSlug;
  style: AttackStyle;
}

/** Each character carries a basic weapon and a signature that must be earned. */
export const ARSENALS: Record<string, Arsenal> = {
  arka: { signature: "pedang_sitasi", basic: "belati_presisi", style: "sword" },
  mira: { signature: "busur_angka", basic: "jaring_bukti", style: "bow" },
  sena: { signature: "lentera_kubur", basic: "perisai_batas", style: "shield" },
  kiran: { signature: "busur_jejak", basic: "kompas_rujukan", style: "bow" },
  vara: { signature: "kapak_vonis", basic: "rantai_batas", style: "axe" },
};

export interface StrikeContext {
  answer: string;
  sourceText: string;
  citations: readonly string[];
  /** Monster HP before this strike, as a share of its maximum. */
  enemyHpRatio: number;
  firstAnswer: boolean;
}

/** Does this answer earn the character's signature weapon? */
export function signatureUnlocked(weapon: WeaponSlug, ctx: StrikeContext): boolean {
  switch (weapon) {
    case "pedang_sitasi":
      return mentionsCitation(ctx.answer, ctx.citations) || hasSixWordQuote(ctx.answer, ctx.sourceText);
    case "busur_angka":
      return mentionsSourceNumber(ctx.answer, ctx.sourceText);
    case "lentera_kubur":
      return mentionsLimitation(ctx.answer);
    case "busur_jejak":
      return hasSixWordQuote(ctx.answer, ctx.sourceText);
    case "kapak_vonis":
      return ctx.enemyHpRatio <= 0.3;
    default:
      return false;
  }
}

function passiveDamage(characterSlug: string, ctx: StrikeContext): number {
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
  /** Sena's shield is still unused on this floor. */
  shieldAvailable: boolean;
  /** Answers too short to judge are not punished. */
  tooShort?: boolean;
}

export function resolveCombat(input: ResolveInput): CombatOutcome {
  const arsenal = ARSENALS[getCharacter(input.characterSlug)?.slug ?? "arka"] ?? ARSENALS.arka!;
  const signature = input.quality > 0 && signatureUnlocked(arsenal.signature, input);
  const weaponSlug = signature ? arsenal.signature : arsenal.basic;
  const power = signature ? WEAPON_POWER.signature : WEAPON_POWER.basic;

  let damage = Math.round(power * QUALITY_MULTIPLIER[input.quality]);
  if (damage > 0) {
    damage += Math.min(PASSIVE_DAMAGE_MAX, passiveDamage(input.characterSlug, input));
  }

  const rawCounter = input.tooShort
    ? 0
    : Math.round(input.monsterAttack * COUNTER_BY_QUALITY[input.quality]);
  const shielded = rawCounter > 0 && arsenal.basic === "perisai_batas" && input.shieldAvailable;

  return {
    quality: input.quality,
    qualityLabel: qualityLabel(input.quality),
    usedEvidence: input.usedEvidence,
    weaponSlug,
    weaponName: getWeapon(weaponSlug)?.name ?? weaponSlug,
    weaponKind: signature ? "signature" : "basic",
    attackStyle: arsenal.style,
    damage,
    counterDamage: shielded ? 0 : rawCounter,
    shielded,
  };
}
