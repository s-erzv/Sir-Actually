import { describe, it, expect } from "vitest";
import { pickAttackType, type AttackType } from "./attackType";

describe("pickAttackType", () => {
  const ALL: AttackType[] = ["clarify", "challenge", "numbers", "limitation"];

  it("returns the first unused type when none have been used", () => {
    const result = pickAttackType(ALL, []);
    expect(ALL).toContain(result);
  });

  it("never returns a used type when unused types remain", () => {
    const used: AttackType[] = ["clarify", "challenge"];
    for (let i = 0; i < 10; i++) {
      const result = pickAttackType(ALL, used, undefined, i);
      expect(used).not.toContain(result);
    }
  });

  it("avoids lastUsed when unused types remain and we have > 1 option", () => {
    const used: AttackType[] = ["clarify"];
    const result = pickAttackType(ALL, used, "challenge", 0);
    expect(result).not.toBe("challenge");
    expect(result).not.toBe("clarify");
  });

  it("after all used, picks any except lastUsed when allowed.length > 1", () => {
    const used: AttackType[] = [...ALL]; // all exhausted
    for (let i = 0; i < 20; i++) {
      const result = pickAttackType(ALL, used, "limitation", i);
      expect(result).not.toBe("limitation");
    }
  });

  it("with a single allowed type, always returns that type regardless of used/lastUsed", () => {
    const single: AttackType[] = ["spot"];
    expect(pickAttackType(single, ["spot"], "spot", 0)).toBe("spot");
    expect(pickAttackType(single, [],       "spot", 0)).toBe("spot");
  });

  it("throws when allowed is empty", () => {
    expect(() => pickAttackType([], [], undefined, 0)).toThrow(
      "allowed list must not be empty",
    );
  });

  it("is deterministic: same inputs → same output", () => {
    const a = pickAttackType(ALL, ["clarify"], "challenge", 2);
    const b = pickAttackType(ALL, ["clarify"], "challenge", 2);
    expect(a).toBe(b);
  });

  it("pickIndex spreads selection across remaining options", () => {
    // With used=["clarify"] and lastUsed=undefined, remaining = ["challenge","numbers","limitation"]
    const used: AttackType[] = ["clarify"];
    const results = new Set<AttackType>();
    for (let i = 0; i < 3; i++) {
      results.add(pickAttackType(ALL, used, undefined, i));
    }
    expect(results.size).toBe(3);
  });
});
