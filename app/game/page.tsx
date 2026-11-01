"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import EncounterOverlay from "@/components/encounter/EncounterOverlay";
import GameHud from "@/components/hud/GameHud";
import Minimap from "@/components/hud/Minimap";
import { HEARTS_START } from "@/lib/balance";
import { buildDummyFloor } from "@/lib/dev/dummyFindings";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

export default function GamePage() {
  const [floorMap] = useState(() => buildDummyFloor(1));
  const [hearts, setHearts] = useState(HEARTS_START);

  return (
    <div
      id="game-root"
      className="relative overflow-hidden bg-[#0D0F15]"
      style={{ width: "100vw", height: "100dvh" }}
    >
      {/* Phaser mounts its canvas here (parent: 'game-root') */}
      <PhaserGame floorMap={floorMap} />
      {/* React HUD + encounter overlay — sit above the canvas */}
      <GameHud floorMap={floorMap} hearts={hearts} />
      <Minimap floorMap={floorMap} />
      <EncounterOverlay hearts={hearts} onHeartsChange={setHearts} />
    </div>
  );
}
