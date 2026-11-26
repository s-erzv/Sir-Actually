/** Camera shake preference shared by the dungeon and the pause menu. */
export type ShakeMode = "off" | "soft" | "full";

const KEY = "sa-shake";

export function getShakeMode(): ShakeMode {
  if (typeof localStorage === "undefined") return "soft";
  const value = localStorage.getItem(KEY);
  return value === "off" || value === "full" ? value : "soft";
}

export function setShakeMode(mode: ShakeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // storage blocked; the session still uses the new value via setter below
  }
  current = mode;
}

let current: ShakeMode | null = null;

export function shakeCamera(
  camera: { shake: (duration: number, intensity: number) => unknown },
  duration: number,
  intensity: number,
): void {
  const mode = current ?? getShakeMode();
  if (mode === "off") return;
  camera.shake(duration, mode === "soft" ? intensity * 0.5 : intensity);
}
