"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import EncounterOverlay from "@/components/encounter/EncounterOverlay";
import type { GeneratedQuestion } from "@/lib/encounter/schema";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const KEY = "dev:1:0";

const BANK: Record<string, GeneratedQuestion[]> = {
  [KEY]: [
    {
      questionId: "dev-question-1",
      question:
        "Kamu bilang sampelnya 120 mahasiswa. Dari mana angka itu, dan kenapa cukup untuk menyimpulkan seluruh kampus?",
      attackType: "challenge",
      weaknessType: "sample_unreported",
      targetCriterionIds: ["evidence"],
      level: 1,
      promptVersion: "dev",
      model: "dev",
    },
  ],
};

/**
 * /dev/battle: the battle screen with a fixture question and a faked judge, no
 * account or LLM. ?boss=1 shows a boss. Development only.
 */
export default function DevBattlePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [hearts, setHearts] = useState(3);

  useEffect(() => {
    const realFetch = window.fetch;
    // authJson asks Supabase for a session first; hand it a fake one here only.
    const auth = getBrowserSupabase().auth;
    const realGetSession = auth.getSession.bind(auth);
    auth.getSession = (async () => ({
      data: { session: { access_token: "dev" } },
      error: null,
    })) as unknown as typeof auth.getSession;
    // Fake the judge so the result narration can be previewed.
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/encounter/answer")) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return new Response(
          JSON.stringify({
            evaluation: {
              scores: [],
              scoreTotal: 6,
              scoreMax: 9,
              damage: 26,
              heartLost: false,
              missing: "Sebutkan teknik sampling yang dipakai.",
              ruleCaps: [],
            },
            newHp: 30,
            newHearts: 3,
            encounterStatus: "active",
            pointsAwarded: 12,
            lootAwarded: 6,
            lootKind: "coins",
            pointsTotal: 40,
            weaponUsed: "pedang_sitasi",
            combat: {
              quality: 3,
              qualityLabel: "Kena",
              usedEvidence: true,
              weaponSlug: "pedang_sitasi",
              weaponName: "Pedang Sitasi",
              weaponKind: "signature",
              attackStyle: "sword",
              damage: 26,
              counterDamage: 8,
              shielded: false,
              absorbed: 10,
              armorBroken: false,
            },
            hp: 292,
            hpMax: 300,
            armor: { slug: "armor_helmet", name: "Helm Besi", shield: 20, shieldMax: 30 },
            monsterLevel: 2,
            monsterHpMax: 56,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/encounter/hint")) {
        return new Response(JSON.stringify({ hint: "Penguji ingin tahu dasar jumlah sampelmu." }), { status: 200 });
      }
      return realFetch(input, init);
    };
    const boss = new URLSearchParams(window.location.search).has("boss");
    const timer = window.setTimeout(() => {
      bus.emit("encounter:start", {
        encounterId: "dev-encounter",
        encounterKey: KEY,
        findingId: "",
        bossSlug: boss ? "kryvax" : "minion-varkul",
        floor: 1,
        room: 0,
        isBoss: boss,
        weaknessType: "sample_unreported",
        severity: 2,
        evidenceQuote: "Penelitian ini melibatkan 120 mahasiswa dari satu fakultas.",
      });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      window.fetch = realFetch;
      auth.getSession = realGetSession;
    };
  }, []);

  return (
    <main className="min-h-screen">
      <EncounterOverlay
        hearts={hearts}
        onHeartsChange={setHearts}
        researchMapId="dev"
        loadout={{ characterSlug: "arka", weaponSlug: "pedang_sitasi" }}
        playerName="Arka"
        heartsMax={3}
        runId=""
        questionBank={BANK}
        onPointsChange={() => undefined}
      />
    </main>
  );
}
