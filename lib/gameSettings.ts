export type ControlScheme = "dpad" | "stick";

export interface GameSettings {
  controls: ControlScheme;
  showMinimap: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  controls: "dpad",
  showMinimap: true,
};

const STORAGE_KEY = "sir:game-settings";

export function readGameSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_GAME_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      controls: parsed.controls === "stick" ? "stick" : "dpad",
      showMinimap: parsed.showMinimap !== false,
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function writeGameSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / storage disabled: settings last for this session only.
  }
}
