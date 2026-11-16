import { describe, expect, it } from "vitest";
import { FLOOR_LAYOUT_VERSION } from "@/game/map/buildFloorPlan";
import { currentProgress, isStaleRunProgress, storedLayoutVersion } from "./runProgress";

describe("run progress versioning", () => {
  it("accepts progress written by the current layout", () => {
    const progress = currentProgress(["f1-r0:0"]);
    expect(storedLayoutVersion(progress)).toBe(FLOOR_LAYOUT_VERSION);
    expect(isStaleRunProgress(progress)).toBe(false);
    expect(progress.resolved).toEqual(["f1-r0:0"]);
  });

  it("treats missing or old versions as stale", () => {
    expect(isStaleRunProgress({ resolved: [] })).toBe(true);
    expect(isStaleRunProgress(null)).toBe(true);
    expect(isStaleRunProgress({ layoutVersion: FLOOR_LAYOUT_VERSION - 1 })).toBe(true);
  });

  it("dedupes and sorts resolved keys", () => {
    expect(currentProgress(["b", "a", "b"]).resolved).toEqual(["a", "b"]);
  });
});
