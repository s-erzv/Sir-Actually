# Dungeon RPG v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the encounter loop into a light RPG (answer quality → weapon damage, HP inside Hearts, monster levels, filler dwellers, treasure and potions) with calmer combat feedback and a landscape mobile layout.

**Architecture:** A pure rules module (`lib/combat/`) converts the Judge's validated scores into a `CombatOutcome`; the answer route applies it and returns it; Phaser and React only render it. Player HP reuses `runs.hearts_left`; shop and potions are `run_points_events` rows. No DB migration.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Phaser 3.88, Supabase, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-17-dungeon-rpg-v2-design.md`

## Global Constraints

- All numbers live in `lib/balance.ts`; no balance literals elsewhere.
- The AI never outputs damage, HP, points or levels (BRIEF §13.9).
- No finding, quote, number or citation is invented; dwellers quiz existing Research Map claims only.
- UI text Indonesian, no emoji. Pixel font classes already in the project.
- Client never sends HP, damage, quality or coins; server computes all of them.
- `pnpm typecheck`, `pnpm test`, `pnpm build` pass at the end of every task.
- Workers do not run `git commit`; the coordinator commits.

## Review Focus

- Double submit of one answer or one purchase: HP, coins and potions change once.
- Buying with too few coins or a full bag (3): rejected with a clear message, nothing charged.
- HP exactly 0 after a counter-attack: run is lost, no negative HP, no further answers accepted.
- A floor whose dimension has no unused claims: zero dwellers, floor still playable.
- Phone rotated mid-encounter: answer text is kept, layout reflows, controls reappear.

---

### Task 1: Combat rules (coordinator)

**Files:** Create `lib/combat/quality.ts`, `lib/combat/monsterStats.ts`, `lib/combat/resolve.ts` (+ `.test.ts` each). Modify `lib/balance.ts`, `lib/loadout.ts`, `lib/domain/types.ts`.

**Produces:**
- `answerQuality(input: { scoreTotal: number; scoreMax: number; addressed: boolean | undefined; usedEvidence: boolean }): Quality`
- `usesManuscriptEvidence(answer: string, sourceText: string, citations: readonly string[]): boolean`
- `monsterStats(kind: "minion" | "boss" | "dweller", level: number): { hp: number; attack: number; maxQuestions: number }`
- `monsterLevel(input: { kind; floorOrder: number; severity?: number }): number`; `gearForLevel(level): { slug: string; name: string }`
- `resolveCombat(input): CombatOutcome` (types in spec §9)

- [x] Tests first: quality table rows; evidence bonus only from base ≥ 2; multiplier table; minion L1 dies to two Telak basic hits; one perfect answer never kills a boss; counter-damage 100% / 40% / 0 by quality; shield cancels one counter.
- [x] Implement, run `pnpm vitest run lib/combat`.

### Task 2: Server wiring (coordinator)

**Files:** Modify `app/api/encounter/answer/route.ts`, `app/api/encounter/state/route.ts`, `app/api/run/start/route.ts`, `app/api/run/retry/route.ts`, `app/api/run/active/route.ts`, `app/api/run/finish/route.ts`, `game/map/buildFloorPlan.ts` (layout version 8), `game/bus.ts`.

- [x] `hearts_left` holds HP; responses carry `hp`, `hpMax`, `hearts`.
- [x] Answer route uses `resolveCombat`; monster HP and max questions from `monsterStats`; response gains `combat`, `hp`, `hpMax`, `monsterLevel`.
- [x] Finish route ranks on gross points (sum of positive events).
- [x] Bus events per spec §9.

### Task 3: Shop and potions (coordinator)

**Files:** Create `lib/combat/shop.ts` (+test), `app/api/run/shop/route.ts`, `app/api/run/potion/route.ts`. Modify `lib/dungeon/loot.ts`, `app/api/run/loot/route.ts`.

**Produces:** `SHOP_ITEMS`, `walletFromEvents(events): { coins; gross; potions }`, `lootKindForKey(key): "points" | "potion"`; endpoints per spec §9.

- [x] Tests: wallet math; bag cap 3; purchase idempotency key `shop:<floor>:<n>`; potion never overheals past `hpMax`.

### Task 4: Dwellers (coordinator)

**Files:** Create `lib/dungeon/dwellers.ts` (+test), modify `game/map/labyrinth.ts` (adds `FloorMap.dwellers: Array<{ id; tile; level; claimIndex }>`), `lib/rubrics.ts`, `lib/domain/types.ts`, `lib/encounter/generate.ts`, answer route.

- [x] Tests: count = `min(3 + floor, 7) − findings`, never negative, never more than eligible claims; spawn tiles are corridor junctions, reachable before the boss gate, not adjacent to a door; deterministic per seed.

### Task 5: Combat presentation (subagent A)

**Files:** `game/entities/*`, `game/scenes/*`, `game/audio.ts`, `game/feel.ts` (new), `app/dev/dungeon/page.tsx`, `lib/sprites/*`.

- [x] Shake tiers and the "Guncangan layar" setting (spec §7); remove full-screen flashes.
- [x] Attack animation by `attackStyle`; damage number shows the quality label.
- [x] Monster level badge, gear name, HP scaled bar; dwellers rendered from `FloorMap.dwellers`.
- [x] Treasure chest in the boss room after the kill → `treasure:open`; potion pickups → `potion:picked`.
- [x] Fix: switching character on `/dev/dungeon` must change the sprite. Add a mock question panel to `/dev/dungeon`, clearly labelled as preview.

### Task 6: Screens and controls (subagent B)

**Files:** `components/**`, `app/**/page.tsx` (not `app/api`, not `app/dev`), `app/globals.css`.

- [x] HUD: Hearts that fill by HP, coin count, potion button, weapon and quality readout in the encounter.
- [x] Shop modal on `treasure:open`.
- [x] Rotate-device gate, D-pad with hold-to-walk, action buttons, safe areas, landscape encounter layout.
- [x] Dungeon framing for landing, dashboard, upload, login, map, findings, report.

### Task 7: Integration (coordinator)

- [x] Full flow on a test account: upload → recon → loadout → fight → shop → potion → next floor.
- [x] `pnpm typecheck && pnpm test && pnpm build`; update `docs/BRIEF.md` pointers; commit.
