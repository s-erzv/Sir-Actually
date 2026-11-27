"use client";

import { useEffect } from "react";
import { startMusic, type MusicTrack } from "@/game/audio";

/**
 * Play a screen's track while it is shown. No stop on unmount: the next screen
 * names its own track, so moving between menus keeps the same song going.
 */
export function useMusic(track: MusicTrack | null): void {
  useEffect(() => {
    if (track) startMusic(track);
  }, [track]);
}
