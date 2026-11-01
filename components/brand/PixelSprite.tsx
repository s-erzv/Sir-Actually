import type { CSSProperties } from "react";
import type { WeaknessType } from "@/lib/domain/types";

export type SpriteKind =
  | "hero"
  | "gap"
  | "veylith"
  | "aligner"
  | "draeven"
  | "methodologist"
  | "kryvax"
  | "auditor"
  | "morvane"
  | "references"
  | "nyxara"
  | "sir"
  | "eldravos"
  | "scroll"
  | "key"
  | "chest";

interface PixelSpriteProps {
  kind: SpriteKind;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function spriteForWeakness(weakness: WeaknessType | string): SpriteKind {
  if (weakness === "problem_objective_gap" || weakness === "objective_rq_mismatch") {
    return "aligner";
  }
  if (
    weakness === "rq_method_mismatch" ||
    weakness === "sample_unreported" ||
    weakness === "generalization_beyond_sample" ||
    weakness === "limitation_missing"
  ) {
    return "methodologist";
  }
  if (
    weakness === "conclusion_overclaim" ||
    weakness === "objective_without_finding" ||
    weakness === "abstract_result_mismatch"
  ) {
    return "auditor";
  }
  if (weakness === "citation_not_found" || weakness === "citation_claim_mismatch") {
    return "references";
  }
  return "gap";
}

export function PixelSprite({ kind, size = 64, className = "", style, title }: PixelSpriteProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`dungeon-map shrink-0 ${className}`}
      style={style}
    >
      {kind === "hero" ? <Hero /> : null}
      {kind === "gap" || kind === "veylith" ? <Gap /> : null}
      {kind === "aligner" || kind === "draeven" ? <Aligner /> : null}
      {kind === "methodologist" || kind === "kryvax" ? <Methodologist /> : null}
      {kind === "auditor" || kind === "morvane" ? <Auditor /> : null}
      {kind === "references" || kind === "nyxara" ? <References /> : null}
      {kind === "sir" || kind === "eldravos" ? <Sir /> : null}
      {kind === "scroll" ? <Scroll /> : null}
      {kind === "key" ? <Key /> : null}
      {kind === "chest" ? <Chest /> : null}
    </svg>
  );
}

function Hero() {
  return (
    <>
      <path d="M13 4 H19 V6 H21 V11 H19 V13 H13 V11 H11 V6 H13 Z" fill="var(--bone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M13 7 H19 V10 H13 Z" fill="var(--ink)" />
      <path d="M14 8 H16 V10 H14 Z" fill="var(--bone)" />
      <path d="M8 13 H24 V18 H22 V27 H18 V23 H14 V27 H10 V18 H8 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M12 13 H20 V20 H12 Z" fill="var(--ash)" />
      <path d="M15 14 H17 V22 H15 Z" fill="var(--bone)" />
      <path d="M6 15 H8 V22 H6 Z M24 15 H26 V22 H24 Z" fill="var(--bone)" />
      <path d="M24 7 H26 V23 H24 Z" fill="var(--ash)" stroke="var(--ink)" strokeWidth="1" />
      <path d="M22 10 H28 V12 H22 Z" fill="var(--bone)" />
      <path d="M24 4 H26 V7 H24 Z" fill="var(--bone)" />
      <path d="M12 27 H18 V30 H12 Z" fill="var(--ink)" />
    </>
  );
}

function Gap() {
  return (
    <>
      <path d="M4 13 H6 V10 H26 V13 H28 V22 H25 V25 H7 V22 H4 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M6 13 H26 V21 H6 Z" fill="var(--ash)" />
      <path d="M9 15 H13 V19 H9 Z M19 15 H23 V19 H19 Z" fill="var(--ink)" />
      <path d="M10 15 H12 V17 H10 Z M20 15 H22 V17 H20 Z" fill="var(--bone)" />
      <path d="M11 22 H21 V24 H19 V23 H13 V24 H11 Z" fill="var(--ink)" />
      <path d="M19 6 H23 V8 H25 V11 H23 V9 H19 Z" fill="var(--bone)" />
    </>
  );
}

function Aligner() {
  return (
    <>
      <path d="M4 16 L8 8 H24 L28 16 L24 24 H8 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M7 16 L10 10 H22 L25 16 L22 22 H10 Z" fill="var(--ash)" />
      <path d="M11 13 H21 V19 H11 Z" fill="var(--bone)" />
      <path d="M14 13 H18 V19 H14 Z" fill="var(--stone)" />
      <path d="M15 14 H17 V18 H15 Z" fill="var(--ink)" />
      <path d="M9 7 H13 V9 H9 Z M19 7 H23 V9 H19 Z" fill="var(--bone)" />
    </>
  );
}

function Methodologist() {
  return (
    <>
      <path d="M6 10 H10 V7 H22 V10 H26 V15 H24 V26 H8 V15 H6 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M9 11 H23 V23 H9 Z" fill="var(--ash)" />
      <path d="M12 13 H15 V16 H12 Z M17 13 H20 V16 H17 Z" fill="var(--bone)" />
      <path d="M14 19 H18 V21 H14 Z" fill="var(--ink)" />
      <path d="M4 14 H6 V21 H4 Z M26 14 H28 V21 H26 Z" fill="var(--bone)" />
      <path d="M11 25 H14 V29 H11 Z M18 25 H21 V29 H18 Z" fill="var(--stone)" />
      <path d="M20 5 H26 V7 H28 V11 H26 V9 H20 Z" fill="var(--bone)" />
      <path d="M21 6 H23 V8 H21 Z" fill="var(--ink)" />
    </>
  );
}

function Auditor() {
  return (
    <>
      <path d="M4 8 H14 V24 H4 Z M18 8 H28 V24 H18 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M6 10 H13 V22 H6 Z M19 10 H26 V22 H19 Z" fill="var(--bone)" />
      <path d="M7 12 H12 V14 H7 Z M20 12 H25 V14 H20 Z" fill="var(--ash)" />
      <path d="M9 15 H11 V18 H9 Z M21 15 H23 V18 H21 Z" fill="var(--ink)" />
      <path d="M14 9 H18 V24 H14 Z" fill="var(--stone)" />
      <path d="M4 6 H8 V8 H4 Z M24 6 H28 V8 H24 Z" fill="var(--bone)" />
    </>
  );
}

function References() {
  return (
    <>
      <path d="M6 9 H10 V5 H22 V9 H26 V25 H22 V22 H18 V25 H14 V22 H10 V25 H6 Z" fill="var(--ash)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M9 9 H23 V20 H9 Z" fill="var(--bone)" />
      <path d="M11 11 H14 V15 H11 Z M18 11 H21 V15 H18 Z" fill="var(--ink)" />
      <path d="M12 12 H14 V14 H12 Z M19 12 H21 V14 H19 Z" fill="var(--ash)" />
      <path d="M13 17 H19 V18 H13 Z" fill="var(--stone)" />
      <path d="M4 12 H6 V19 H4 Z M26 12 H28 V19 H26 Z" fill="var(--stone)" />
    </>
  );
}

function Sir() {
  return (
    <>
      <path d="M16 2 L28 7 V16 L26 21 L21 26 L16 30 L11 26 L6 21 L4 16 V7 Z" fill="var(--ink)" stroke="var(--bone)" strokeWidth="2" />
      <path d="M18 4 H23 V6 H26 V9 H24 V7 H22 V9 H20 V7 H18 Z" fill="var(--ash)" />
      <path d="M12 8 H20 V10 H22 V16 H20 V20 H12 V16 H10 V10 H12 Z" fill="var(--bone)" />
      <path d="M11 11 H21 V14 H11 Z" fill="var(--ink)" />
      <path d="M13 12 H15 V14 H13 Z M17 12 H19 V14 H17 Z" fill="var(--bone)" />
      <path d="M12 16 H15 V20 H12 Z M17 16 H20 V20 H17 Z M14 20 H18 V22 H14 Z" fill="var(--ash)" />
      <path d="M7 9 H8 V11 H7 Z M24 9 H25 V11 H24 Z" fill="var(--bone)" />
    </>
  );
}

function Scroll() {
  return (
    <>
      <path d="M8 5 H24 V9 H22 V26 H10 V9 H8 Z" fill="var(--ash)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M10 9 H22 V25 H10 Z" fill="var(--bone)" />
      <path d="M13 12 H19 V13 H13 Z M13 15 H20 V16 H13 Z M13 18 H18 V19 H13 Z M13 21 H16 V22 H13 Z" fill="var(--stone)" />
      <path d="M22 5 H26 V9 H22 Z M6 5 H10 V9 H6 Z" fill="var(--ash)" />
    </>
  );
}

function Key() {
  return (
    <>
      <path d="M5 12 H13 V20 H5 Z" fill="var(--bone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M8 14 H10 V18 H8 Z" fill="var(--ink)" />
      <path d="M13 14 H27 V16 H13 Z M20 16 H22 V20 H20 Z M24 16 H26 V19 H24 Z" fill="var(--bone)" />
    </>
  );
}

function Chest() {
  return (
    <>
      <path d="M4 12 H6 V8 H26 V12 H28 V26 H4 Z" fill="var(--stone)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M6 13 H26 V18 H6 Z" fill="var(--ash)" />
      <path d="M6 19 H26 V24 H6 Z" fill="var(--stone)" />
      <path d="M14 17 H18 V23 H14 Z" fill="var(--bone)" />
      <path d="M15 19 H17 V21 H15 Z" fill="var(--ink)" />
      <path d="M5 10 H10 V12 H5 Z M22 10 H27 V12 H22 Z" fill="var(--bone)" />
    </>
  );
}
