import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOSS_SHEETS, MINION_SHEETS, monsterPortraitFor } from "./monsters";

const root = join(process.cwd(), "public");

function publicFile(url: string): string {
  return join(root, url.replace(/^\//, ""));
}

describe("monster art registry", () => {
  it("has every minion sheet, face, and portrait on disk", () => {
    for (const sheet of Object.values(MINION_SHEETS)) {
      expect(existsSync(publicFile(sheet.path)), sheet.path).toBe(true);
      expect(existsSync(publicFile(sheet.face)), sheet.face).toBe(true);
      expect(existsSync(publicFile(sheet.portrait)), sheet.portrait).toBe(true);
    }
  });

  it("has every boss sheet, face, and portrait on disk", () => {
    for (const sheet of Object.values(BOSS_SHEETS)) {
      for (const path of [sheet.idle, sheet.hit, sheet.face, sheet.portrait]) {
        expect(existsSync(publicFile(path)), path).toBe(true);
      }
      if (sheet.walk) expect(existsSync(publicFile(sheet.walk)), sheet.walk).toBe(true);
    }
  });

  it("resolves portraits for both encounter slug shapes", () => {
    expect(monsterPortraitFor("minion-varkul", false)).toContain("minion-varkul");
    expect(monsterPortraitFor("veylith", true)).toContain("veylith");
    expect(monsterPortraitFor("unknown", true)).toBeUndefined();
  });
});
