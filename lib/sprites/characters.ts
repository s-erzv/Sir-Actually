/**
 * Single source of truth for playable-character pixel art.
 *
 * The React UI renders these paths as SVG; Phaser rasterises the same paths
 * into textures at boot, so the character chosen in the loadout is literally
 * the character that appears in the dungeon.
 */

export type CharacterArtSlug = "arka" | "mira" | "sena" | "kiran" | "vara";

export interface CharacterPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export const CHARACTER_PATHS: Record<CharacterArtSlug, readonly CharacterPath[]> = {
  arka: [
    { d: "M13 4 H19 V6 H21 V11 H19 V13 H13 V11 H11 V6 H13 Z", fill: "#f0e7d5", stroke: "#05070a", strokeWidth: 2 },
    { d: "M13 7 H19 V10 H13 Z", fill: "#080b10" },
    { d: "M14 8 H16 V10 H14 Z", fill: "#6fb6c5" },
    { d: "M8 13 H24 V18 H22 V27 H18 V23 H14 V27 H10 V18 H8 Z", fill: "#6d8794", stroke: "#05070a", strokeWidth: 2 },
    { d: "M12 13 H20 V20 H12 Z", fill: "#8da6b2" },
    { d: "M15 14 H17 V22 H15 Z", fill: "#e9b85d" },
    { d: "M6 15 H8 V22 H6 Z M24 15 H26 V22 H24 Z", fill: "#f0e7d5" },
    { d: "M24 7 H26 V23 H24 Z", fill: "#e9b85d", stroke: "#05070a", strokeWidth: 1 },
    { d: "M22 10 H28 V12 H22 Z", fill: "#c98b32" },
    { d: "M24 4 H26 V7 H24 Z", fill: "#f5d78e" },
    { d: "M12 27 H18 V30 H12 Z", fill: "#05070a" },
  ],
  mira: [
    { d: "M16 3 L23 6 L25 12 L23 17 H9 L7 12 L9 6 Z", fill: "#42666b", stroke: "#05070a", strokeWidth: 2 },
    { d: "M12 9 H20 V14 H12 Z", fill: "#070b10" },
    { d: "M13 10 H15 V12 H13 Z M17 10 H19 V12 H17 Z", fill: "#8f95d9" },
    { d: "M10 17 H22 V29 H10 Z", fill: "#42666b", stroke: "#05070a", strokeWidth: 2 },
    { d: "M13 18 H19 V28 H13 Z", fill: "#6d9ba0" },
    { d: "M16 18 V27", stroke: "#8f95d9", strokeWidth: 2 },
    { d: "M26 7 H28 V29 H26 Z", fill: "#8f95d9", stroke: "#05070a", strokeWidth: 1 },
    { d: "M24 3 H30 V8 H24 Z", fill: "#b6bbec", stroke: "#05070a", strokeWidth: 2 },
    { d: "M4 18 H9 V25 H4 Z", fill: "#e9d8b1", stroke: "#05070a", strokeWidth: 2 },
    { d: "M5 20 H8 V21 H5 Z M5 22 H8 V23 H5 Z", fill: "#806b47" },
  ],
  sena: [
    { d: "M12 3 H20 V5 H23 V10 H9 V5 H12 Z", fill: "#ece4cd", stroke: "#05070a", strokeWidth: 2 },
    { d: "M12 7 H20 V9 H12 Z", fill: "#070b10" },
    { d: "M13 8 H15 V9 H13 Z M17 8 H19 V9 H17 Z", fill: "#8fbd72" },
    { d: "M7 13 H25 V27 H7 Z", fill: "#4f6350", stroke: "#05070a", strokeWidth: 2 },
    { d: "M10 14 H22 V24 H10 Z", fill: "#7d9678" },
    { d: "M14 15 H18 V23 H14 Z", fill: "#e9b85d" },
    { d: "M3 14 H9 V26 H3 Z", fill: "#5d7d4a", stroke: "#05070a", strokeWidth: 2 },
    { d: "M4 17 H8 V19 H4 Z M5 20 H7 V25 H5 Z", fill: "#e9b85d" },
    { d: "M25 8 H27 V24 H25 Z", fill: "#e9b85d", stroke: "#05070a", strokeWidth: 1 },
    { d: "M9 27 H23 V30 H9 Z", fill: "#070b10" },
  ],
  kiran: [
    { d: "M16 2 L21 4 L24 10 L22 15 H10 L8 10 L11 4 Z", fill: "#4b5f52", stroke: "#05070a", strokeWidth: 2 },
    { d: "M12 8 H20 V13 H12 Z", fill: "#070b10" },
    { d: "M13 9 H15 V11 H13 Z M17 9 H19 V11 H17 Z", fill: "#b7d488" },
    { d: "M10 15 H22 V27 H10 Z", fill: "#4b5f52", stroke: "#05070a", strokeWidth: 2 },
    { d: "M13 16 H19 V26 H13 Z", fill: "#738c72" },
    { d: "M16 16 V26", stroke: "#b7d488", strokeWidth: 2 },
    { d: "M7 7 Q2 16 7 25", fill: "none", stroke: "#b7d488", strokeWidth: 2 },
    { d: "M7 7 V25", stroke: "#f2ecdd", strokeWidth: 1 },
    { d: "M22 12 H24 V24 H22 Z", fill: "#6a4a2c", stroke: "#05070a", strokeWidth: 1 },
    { d: "M23 10 V13 M24 10 V13", stroke: "#e9b85d", strokeWidth: 1 },
    { d: "M12 27 H16 V30 H12 Z M18 27 H22 V30 H18 Z", fill: "#070b10" },
  ],
  vara: [
    { d: "M9 4 L6 1 L8 8 Z M23 4 L26 1 L24 8 Z", fill: "#cf5c68", stroke: "#05070a", strokeWidth: 1 },
    { d: "M10 4 H22 V6 H24 V11 H8 V6 H10 Z", fill: "#3a3344", stroke: "#05070a", strokeWidth: 2 },
    { d: "M11 8 H21 V10 H11 Z", fill: "#070b10" },
    { d: "M13 8 H15 V9 H13 Z M17 8 H19 V9 H17 Z", fill: "#cf5c68" },
    { d: "M8 13 H24 V27 H8 Z", fill: "#3a3344", stroke: "#05070a", strokeWidth: 2 },
    { d: "M11 15 H21 V25 H11 Z", fill: "#665a78" },
    { d: "M15 15 H17 V25 H15 Z", fill: "#cf5c68" },
    { d: "M24 6 V28 H26 V6 Z", fill: "#8a6a34", stroke: "#05070a", strokeWidth: 1 },
    { d: "M23 6 L29 3 V12 L23 9 Z", fill: "#c9a75a", stroke: "#05070a", strokeWidth: 2 },
    { d: "M6 15 H8 V25 H6 Z", fill: "#241f2b" },
    { d: "M9 27 H23 V30 H9 Z", fill: "#070b10" },
  ],
};

export function characterArtFor(slug: string): readonly CharacterPath[] {
  if (slug in CHARACTER_PATHS) return CHARACTER_PATHS[slug as CharacterArtSlug];
  return CHARACTER_PATHS.arka;
}
