import { describe, expect, it } from "vitest";
import { currentFloorFromCleared } from "./runFloor";

describe("currentFloorFromCleared", () => {
  it("starts at floor 1", () => {
    expect(currentFloorFromCleared([])).toBe(1);
  });

  it("advances one floor after a clear", () => {
    expect(currentFloorFromCleared([1])).toBe(2);
    expect(currentFloorFromCleared([1, 2, 3])).toBe(4);
    expect(currentFloorFromCleared([1, 3])).toBe(4);
  });

  it("never exceeds the planned floor count", () => {
    expect(currentFloorFromCleared([1, 2, 3], 3)).toBe(3);
  });
});
