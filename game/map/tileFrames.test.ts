import { describe, expect, it } from "vitest";
import { PLAYER_FRAMES_BY_CHARACTER, playerFrameFor } from "./tileFrames";

describe("playerFrameFor", () => {
  it("gives each character a distinct in-game sprite", () => {
    const frames = ["arka", "mira", "sena", "kiran", "vara"].map((slug) =>
      playerFrameFor(slug),
    );
    expect(new Set(frames).size).toBe(5);
    expect(frames).toEqual([
      PLAYER_FRAMES_BY_CHARACTER.arka,
      PLAYER_FRAMES_BY_CHARACTER.mira,
      PLAYER_FRAMES_BY_CHARACTER.sena,
      PLAYER_FRAMES_BY_CHARACTER.kiran,
      PLAYER_FRAMES_BY_CHARACTER.vara,
    ]);
  });

  it("falls back to the default frame", () => {
    expect(playerFrameFor("unknown")).toBe(87);
  });
});
