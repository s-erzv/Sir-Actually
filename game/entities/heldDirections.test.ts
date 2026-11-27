import { describe, expect, it } from "vitest";
import { pushHeld, releaseHeld } from "./heldDirections";

describe("held directions", () => {
  it("lets the newest key win while an older one is still held", () => {
    let held = pushHeld([], "up");
    held = pushHeld(held, "right");
    expect(held[0]).toBe("right");
  });

  it("falls back to the older key once the newer one is released", () => {
    let held = pushHeld(pushHeld([], "up"), "right");
    held = releaseHeld(held, "right");
    expect(held).toEqual(["up"]);
  });

  it("never lists a direction twice", () => {
    expect(pushHeld(["left", "up"], "left")).toEqual(["left", "up"]);
  });
});
