import * as Phaser from "phaser";
import { TILE_SIZE, TileCode, isSolid } from "@/game/map/tiles";
import {
  bossFrame,
  minionFrameForSlug,
} from "@/game/map/tileFrames";
import { getMinionForRoom, MINION_ROSTER } from "@/lib/monsters";
import {
  BOSS_SHEETS,
  MINION_SHEETS,
  bossHitAnim,
  bossIdleAnim,
  bossIdleKey,
  bossWalkKey,
  minionArtKey,
  minionWalkAnim,
} from "@/lib/sprites/monsters";
import { FACING_COLUMN, attackFrame, type Facing } from "@/lib/sprites/sheets";
import type { AttackStyle, EncounterTopic, FindingMeta, FloorMap, Room } from "@/lib/domain/types";
import {
  MONSTER_BEHAVIORS,
  behaviorForSpawn,
  shouldChase,
} from "./monsterBehavior";
import type { MonsterBehavior } from "./monsterBehavior";
import { patrolCandidates } from "@/lib/dungeon/patrol";
import { gearForLevel, monsterLevel, monsterStats } from "@/lib/combat/monsterStats";

let encounterCounter = 0;

export class Monster {
  readonly sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  private exclamation: Phaser.GameObjects.Text | null = null;
  private breathTween: Phaser.Tweens.Tween | null = null;
  private animSlug: string | null = null;
  private bossAnimSlug: string | null = null;
  private facing: Facing = "down";
  readonly level: number;
  private readonly gearName: string;
  private hpBarBg: Phaser.GameObjects.Rectangle | null = null;
  private hpBarFill: Phaser.GameObjects.Rectangle | null = null;
  private badge: Phaser.GameObjects.Text | null = null;

  readonly encounterId: string;
  readonly encounterKey: string;
  readonly findingId: string;
  readonly bossSlug: string;
  readonly isBoss: boolean;
  readonly isDweller: boolean;
  readonly floor: number;
  readonly roomIndex: number;
  readonly roomId: string;
  readonly weaknessType: EncounterTopic;
  readonly evidenceQuote: string;
  readonly severity?: number;

  tileX: number;
  tileY: number;

  resolved = false;
  private moving = false;
  private readonly room: Room;
  private readonly behavior: MonsterBehavior;
  private alerted = false;
  private readonly homeX: number;
  private readonly homeY: number;
  private nextPatrolAt = 0;

  constructor(
    scene: Phaser.Scene,
    worldX: number,
    worldY: number,
    isBoss: boolean,
    room: Room,
    floorOrder: number,
    meta?: FindingMeta,
    spawn?: {
      findingId?: string | null;
      bossSlug?: string;
      weaknessType?: EncounterTopic;
      evidenceQuote?: string;
      minionSlug?: string;
    },
    monsterIndex = 0,
  ) {
    encounterCounter++;
    this.encounterId = `enc-${encounterCounter}`;
    this.encounterKey = `${room.id}:${monsterIndex}`;
    this.findingId = spawn?.findingId ?? room.findingId ?? "";
    this.isBoss = isBoss;
    this.floor = floorOrder;
    this.roomIndex = parseInt(room.id.split("-r")[1] ?? "0", 10);
    this.roomId = room.id;
    this.room = room;
    this.behavior = behaviorForSpawn(isBoss, monsterIndex);
    const behavior = MONSTER_BEHAVIORS[this.behavior];
    const minion = spawn?.minionSlug
      ? (MINION_ROSTER.find((entry) => entry.slug === spawn.minionSlug) ?? getMinionForRoom(floorOrder, this.roomIndex))
      : getMinionForRoom(floorOrder, this.roomIndex);
    this.bossSlug = spawn?.bossSlug ?? (isBoss ? `boss-floor-${floorOrder}` : `minion-${minion.slug}`);
    this.weaknessType = spawn?.weaknessType ?? meta?.weaknessType ?? "gap_unsupported";
    this.isDweller = this.weaknessType === "comprehension";
    this.evidenceQuote = spawn?.evidenceQuote ?? meta?.evidenceQuote ?? "";
    this.severity = meta?.severity;
    const kind = this.weaknessType === "comprehension" ? "dweller" : isBoss ? "boss" : "minion";
    this.level = monsterLevel({ kind, floorOrder, severity: meta?.severity });
    const stats = monsterStats(kind, this.level);
    this.gearName = gearForLevel(this.level).name;

    this.tileX = Math.floor(worldX / TILE_SIZE);
    this.tileY = Math.floor(worldY / TILE_SIZE);
    this.homeX = this.tileX;
    this.homeY = this.tileY;

    const bossSlug = spawn?.bossSlug && BOSS_SHEETS[spawn.bossSlug] ? spawn.bossSlug : undefined;
    const bossSheet = bossSlug ? BOSS_SHEETS[bossSlug] : undefined;
    const minionSheet = MINION_SHEETS[minion.slug];

    if (isBoss && bossSheet && scene.textures.exists(bossIdleKey(bossSlug!))) {
      this.bossAnimSlug = bossSlug!;
      this.sprite = scene.add.sprite(worldX, worldY, bossIdleKey(bossSlug!), 0);
      this.sprite.setScale(1);
    } else if (!isBoss && minionSheet && scene.textures.exists(minionArtKey(minion.slug))) {
      this.animSlug = minion.slug;
      this.sprite = scene.add.sprite(worldX, worldY, minionArtKey(minion.slug), 0);
      this.sprite.setScale(1.25);
    } else {
      const frame = isBoss
        ? bossFrame(spawn?.bossSlug, floorOrder)
        : minionFrameForSlug(minion.slug, floorOrder);
      this.sprite = scene.add.image(worldX, worldY, "tiles", frame);
      this.sprite.setScale(isBoss ? 2 : 1);
    }
    this.sprite.setOrigin(0.5, 0.5).setDepth(9);

    if (this.bossAnimSlug && this.sprite instanceof Phaser.GameObjects.Sprite) {
      this.sprite.play(bossIdleAnim(this.bossAnimSlug));
    }

    const baseScale = this.sprite.scaleX;
    if (isBoss) {
      // Breathing tween: subtle pulse.
      this.breathTween = scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale * 1.04,
        scaleY: baseScale * 1.04,
        duration: 900,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      // Scale pulse instead of moving y: chase movement also tweens x/y.
      this.breathTween = scene.tweens.add({
        targets: this.sprite,
        scaleX: baseScale * 1.06,
        scaleY: baseScale * 1.06,
        duration: 1100 + Math.random() * 500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // "!" marker above sprite so player knows they can interact
    this.exclamation = scene.add.text(
      worldX,
      worldY - TILE_SIZE * (isBoss ? 1.5 : 1),
      behavior.dormantMarker,
      {
        fontSize: "10px",
        color: behavior.dormantColor,
        fontFamily: "Arial, sans-serif",
        stroke: "#000000",
        strokeThickness: 2,
      },
    ).setOrigin(0.5, 1).setDepth(11);

    const badgeY = worldY - TILE_SIZE * (isBoss ? 1.9 : 1.35);
    this.badge = scene.add
      .text(worldX, badgeY, `Lv ${this.level} · ${this.gearName}`, {
        fontSize: "8px",
        color: isBoss ? "#cf5c68" : "#e9b85d",
        fontFamily: "monospace",
        stroke: "#05070a",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(12);

    const barWidth = isBoss ? 34 : 22;
    const barY = badgeY + 7;
    this.hpBarBg = scene.add
      .rectangle(worldX - barWidth / 2, barY, barWidth, 3, 0x05070a, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.hpBarFill = scene.add
      .rectangle(worldX - barWidth / 2, barY, barWidth, 2, isBoss ? 0xcf5c68 : 0x8fbd72, 1)
      .setOrigin(0, 0.5)
      .setDepth(13);
    this.setHealth(stats.hp, stats.hp);
  }

  /** Update the in-world HP bar from the server's post-strike value. */
  setHealth(hp: number, hpMax: number): void {
    if (!this.hpBarFill) return;
    const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
    this.hpBarFill.scaleX = ratio;
  }

  /**
   * An answer landed. White flash, knockback away from the attacker, a slash
   * across the sprite, sparks and a damage number sized by the hit.
   */
  playHit(
    scene: Phaser.Scene,
    damage: number,
    from?: { x: number; y: number },
    style: AttackStyle = "sword",
    qualityLabel?: string,
  ): void {
    if (this.resolved) return;
    const homeX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const homeY = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    if (damage <= 0) {
      // A miss: the monster sidesteps.
      scene.tweens.add({
        targets: this.sprite,
        x: homeX + 4,
        duration: 70,
        ease: "Quad.easeOut",
        yoyo: true,
        onComplete: () => this.sprite.setPosition(homeX, homeY),
      });
      this.floatText(scene, "MISS", "#9aa3ad", 10);
      return;
    }

    const heavy = damage >= 35;
    const dx = from ? homeX - from.x : 0;
    const dy = from ? homeY - from.y : -1;
    const length = Math.hypot(dx, dy) || 1;
    const push = heavy ? 7 : 4;

    this.sprite.setTintFill(0xffffff);
    this.playHurtFrame(scene);
    scene.time.delayedCall(90, () => {
      if (this.resolved) return;
      this.sprite.setTint(0xff5a5a);
      scene.time.delayedCall(140, () => {
        if (!this.resolved) this.sprite.clearTint();
      });
    });
    scene.tweens.add({
      targets: this.sprite,
      x: homeX + (dx / length) * push,
      y: homeY + (dy / length) * push,
      duration: 80,
      ease: "Quad.easeOut",
      yoyo: true,
      hold: 40,
      onComplete: () => this.sprite.setPosition(homeX, homeY),
    });

    if (style === "sword" || style === "axe") {
      this.playSlashFx(scene, homeX, homeY, heavy || style === "axe", dx >= 0);
    }
    this.burst(scene, 0xfff3c4, heavy ? 10 : 6, heavy ? 16 : 11, 260);
    this.burst(scene, 0xc02020, heavy ? 8 : 5, heavy ? 18 : 12, 360);
    this.floatText(scene, `-${damage}`, heavy ? "#ffd166" : "#ff6b6b", heavy ? 14 : 11);
    if (qualityLabel) {
      this.floatText(scene, qualityLabel, "#f2ecdd", 9, 16);
    }
  }

  /** Bosses have a dedicated hit sheet; minions flash in place. */
  private playHurtFrame(scene: Phaser.Scene): void {
    if (!(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
    if (this.bossAnimSlug) {
      this.sprite.play(bossHitAnim(this.bossAnimSlug), true);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.resolved || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        this.sprite.play(bossIdleAnim(this.bossAnimSlug!));
      });
      return;
    }
    if (this.animSlug) {
      this.sprite.setFrame(5 * 4 + FACING_COLUMN[this.facing]);
      scene.time.delayedCall(180, () => {
        if (this.resolved || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        this.sprite.setFrame(FACING_COLUMN[this.facing]);
      });
    }
  }

  /** Real slash sprite instead of a hand-drawn line. */
  private playSlashFx(
    scene: Phaser.Scene,
    x: number,
    y: number,
    heavy: boolean,
    faceRight: boolean,
  ): void {
    const key = heavy ? "fx-cut-double" : "fx-cut";
    if (!scene.textures.exists(key)) {
      const streak = scene.add
        .rectangle(x, y, heavy ? 34 : 24, 3, 0xfff3c4)
        .setDepth(60)
        .setRotation(-0.9)
        .setScale(0.2, 1);
      scene.tweens.add({
        targets: streak,
        scaleX: 1,
        alpha: 0,
        duration: 160,
        ease: "Cubic.easeOut",
        onComplete: () => streak.destroy(),
      });
      return;
    }
    const effect = scene.add
      .sprite(x, y, key)
      .setDepth(60)
      .setScale(heavy ? 1.9 : 1.4)
      .setFlipX(!faceRight)
      .setAlpha(0.95);
    effect.play({ key: `${key}-play`, startFrame: 0 });
    scene.time.delayedCall(260, () => effect.destroy());
  }

  /** The answer cost a Heart: the monster lunges at the player. */
  playCounter(scene: Phaser.Scene, target: { x: number; y: number }): void {
    if (this.resolved) return;
    const homeX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const homeY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    const dx = target.x - homeX;
    const dy = target.y - homeY;
    const length = Math.hypot(dx, dy) || 1;
    this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up";
    if (this.sprite instanceof Phaser.GameObjects.Sprite && this.animSlug) {
      this.sprite.anims.stop();
      this.sprite.setFrame(attackFrame(this.facing));
      scene.time.delayedCall(220, () => {
        if (this.resolved || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        this.sprite.setFrame(FACING_COLUMN[this.facing]);
      });
    }
    scene.tweens.add({
      targets: this.sprite,
      x: homeX + (dx / length) * 8,
      y: homeY + (dy / length) * 8,
      duration: 90,
      ease: "Back.easeIn",
      yoyo: true,
      onComplete: () => this.sprite.setPosition(homeX, homeY),
    });
  }

  private floatText(scene: Phaser.Scene, label: string, color: string, size: number, offset = 0): void {
    const text = scene.add
      .text(this.sprite.x, this.sprite.y - 10 - offset, label, {
        fontSize: `${size}px`,
        color,
        fontFamily: "monospace",
        fontStyle: "bold",
        stroke: "#05070a",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setScale(0.4);
    scene.tweens.add({ targets: text, scale: 1, duration: 120, ease: "Back.easeOut" });
    scene.tweens.add({
      targets: text,
      y: text.y - 26,
      alpha: 0,
      delay: 160,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private burst(scene: Phaser.Scene, tint: number, count: number, radius: number, duration: number): void {
    for (let index = 0; index < count; index++) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.5;
      const reach = radius * (0.6 + Math.random() * 0.6);
      const spark = scene.add.rectangle(this.sprite.x, this.sprite.y, 2, 2, tint).setDepth(59);
      scene.tweens.add({
        targets: spark,
        x: this.sprite.x + Math.cos(angle) * reach,
        y: this.sprite.y + Math.sin(angle) * reach,
        alpha: 0,
        duration: duration * (0.7 + Math.random() * 0.6),
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  markResolved(result: "won" | "conceded" | "disputed" | "fled"): void {
    this.resolved = true;
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.exclamation = null;

    // Conceded monsters stay in the room as greyed-out witnesses. Only a
    // real win (or a disputed finding) removes the sprite.
    if (result === "conceded") {
      this.sprite.setTint(0x6b7280);
      this.sprite.setAlpha(0.45);
      return;
    }

    const scene = this.sprite.scene;
    if (result !== "won") {
      this.burst(scene, 0xcbd5e1, 8, 12, 380);
      scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 400,
        onComplete: () => this.sprite.destroy(),
      });
      return;
    }

    // Slain: stagger, flash, then burst apart.
    const baseScale = this.sprite.scaleX;
    if (this.sprite instanceof Phaser.GameObjects.Sprite) this.sprite.anims.stop();
    this.sprite.setTintFill(0xffffff);
    scene.tweens.add({
      targets: this.sprite,
      angle: { from: -12, to: 12 },
      duration: 60,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.burst(scene, 0xffd166, this.isBoss ? 22 : 14, this.isBoss ? 30 : 20, 520);
        this.burst(scene, 0xff6b6b, this.isBoss ? 12 : 8, this.isBoss ? 20 : 13, 420);
        const ring = scene.add.circle(this.sprite.x, this.sprite.y, 4).setStrokeStyle(2, 0xffd166).setDepth(58);
        scene.tweens.add({
          targets: ring,
          scale: this.isBoss ? 7 : 4.5,
          alpha: 0,
          duration: 420,
          ease: "Cubic.easeOut",
          onComplete: () => ring.destroy(),
        });
        scene.tweens.add({
          targets: this.sprite,
          scaleX: baseScale * 1.6,
          scaleY: 0,
          alpha: 0,
          duration: 220,
          ease: "Quad.easeIn",
          onComplete: () => this.sprite.destroy(),
        });
      },
    });
  }

  private setAlerted(alerted: boolean): void {
    if (this.alerted === alerted) return;
    this.alerted = alerted;
    const behavior = MONSTER_BEHAVIORS[this.behavior];
    this.exclamation?.setText(alerted ? behavior.activeMarker : behavior.dormantMarker);
    this.exclamation?.setColor(alerted ? behavior.activeColor : behavior.dormantColor);
  }

  /**
   * Chase the player while they are inside this monster's room.
   * Movement is one tile at a time, bounded by the room and blocking tiles.
   */
  updateChase(
    playerTile: { x: number; y: number },
    floorMap: FloorMap,
    occupied: ReadonlySet<string>,
  ): void {
    if (this.resolved || this.moving) return;

    const minX = this.room.rect.x + 1;
    const maxX = this.room.rect.x + this.room.rect.width - 2;
    const minY = this.room.rect.y + 1;
    const maxY = this.room.rect.y + this.room.rect.height - 2;
    const insideRoom =
      playerTile.x >= minX &&
      playerTile.x <= maxX &&
      playerTile.y >= minY &&
      playerTile.y <= maxY;
    if (!insideRoom) {
      this.setAlerted(false);
      this.tryPatrol(playerTile, floorMap, occupied);
      return;
    }

    const chasing = shouldChase(
      this.behavior,
      { x: this.tileX, y: this.tileY },
      playerTile,
      insideRoom,
    );
    this.setAlerted(chasing);
    if (!chasing || (playerTile.x === this.tileX && playerTile.y === this.tileY)) {
      this.tryPatrol(playerTile, floorMap, occupied);
      return;
    }

    const startKey = `${this.tileX},${this.tileY}`;
    const goalKey = `${playerTile.x},${playerTile.y}`;
    if (startKey === goalKey) return;

    const queue: Array<{ x: number; y: number }> = [{ x: this.tileX, y: this.tileY }];
    const previous = new Map<string, string | null>([[startKey, null]]);
    let found = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.x},${current.y}`;
      if (currentKey === goalKey) {
        found = true;
        break;
      }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const key = `${nx},${ny}`;
        if (previous.has(key)) continue;
        if (occupied.has(key) && key !== goalKey) continue;
        const code = (floorMap.tiles[ny]?.[nx] ?? TileCode.VOID) as TileCode;
        if (isSolid(code) || code === TileCode.VOID) continue;
        previous.set(key, currentKey);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!found) return;

    let stepKey = goalKey;
    while (true) {
      const parent = previous.get(stepKey);
      if (!parent || parent === startKey) break;
      stepKey = parent;
    }
    const [stepX, stepY] = stepKey.split(",").map(Number) as [number, number];
    if (stepX === this.tileX && stepY === this.tileY) return;

    this.moveToTile(stepX, stepY);
  }

  /** One-tile hop with tween + marker sync. */
  private moveToTile(stepX: number, stepY: number): void {
    const dx = stepX - this.tileX;
    const dy = stepY - this.tileY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) this.facing = dx > 0 ? "right" : "left";
    } else if (dy !== 0) {
      this.facing = dy > 0 ? "down" : "up";
    }

    this.tileX = stepX;
    this.tileY = stepY;
    this.moving = true;
    if (this.exclamation) {
      this.exclamation.setPosition(
        stepX * TILE_SIZE + TILE_SIZE / 2,
        stepY * TILE_SIZE + TILE_SIZE / 2 - TILE_SIZE * (this.isBoss ? 1.5 : 1),
      );
      const barX = stepX * TILE_SIZE + TILE_SIZE / 2;
      const barY = stepY * TILE_SIZE + TILE_SIZE / 2 - TILE_SIZE * (this.isBoss ? 1.9 : 1.35) + 7;
      const barWidth = this.isBoss ? 34 : 22;
      this.badge?.setPosition(barX, barY - 7);
      this.hpBarBg?.setPosition(barX - barWidth / 2, barY);
      this.hpBarFill?.setPosition(barX - barWidth / 2, barY);
    }
    this.playWalk();
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      x: stepX * TILE_SIZE + TILE_SIZE / 2,
      y: stepY * TILE_SIZE + TILE_SIZE / 2,
      duration: MONSTER_BEHAVIORS[this.behavior].moveDuration,
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
        this.stopWalk();
      },
    });
  }

  private playWalk(): void {
    if (!(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
    if (this.animSlug) {
      this.sprite.play(minionWalkAnim(this.animSlug, this.facing), true);
    } else if (this.bossAnimSlug && this.sprite.scene.textures.exists(bossWalkKey(this.bossAnimSlug))) {
      const animKey = `${this.bossAnimSlug}-boss-walk`;
      if (this.sprite.scene.anims.exists(animKey)) this.sprite.play(animKey, true);
    }
  }

  private stopWalk(): void {
    if (!(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
    if (this.animSlug) {
      this.sprite.anims.stop();
      this.sprite.setFrame(FACING_COLUMN[this.facing]);
    } else if (this.bossAnimSlug) {
      this.sprite.play(bossIdleAnim(this.bossAnimSlug), true);
    }
  }

  /** Idle wander for non-bosses, kept near their spawn and inside the room. */
  private tryPatrol(
    playerTile: { x: number; y: number },
    floorMap: FloorMap,
    occupied: ReadonlySet<string>,
  ): void {
    if (this.resolved || this.moving || this.isBoss || this.behavior === "hunter") return;
    const now = this.sprite.scene.time.now;
    if (now < this.nextPatrolAt) return;
    this.nextPatrolAt = now + 1400 + Math.floor(Math.random() * 1800);

    const options = patrolCandidates({
      current: { x: this.tileX, y: this.tileY },
      home: { x: this.homeX, y: this.homeY },
      roomRect: this.room.rect,
      playerTile,
      occupied,
      tiles: floorMap.tiles,
    });

    if (options.length === 0) return;
    const step = options[Math.floor(Math.random() * options.length)]!;
    this.moveToTile(step.x, step.y);
  }

  /** Remove immediately (used when resuming a saved run). */
  markResolvedImmediate(): void {
    this.resolved = true;
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.exclamation = null;
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.badge?.destroy();
    this.hpBarBg = null;
    this.hpBarFill = null;
    this.badge = null;
    this.sprite.destroy();
  }

  /** Hard destroy (used on floor:retry). */
  destroy(): void {
    this.breathTween?.stop();
    this.exclamation?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.badge?.destroy();
    this.hpBarBg = null;
    this.hpBarFill = null;
    this.badge = null;
    this.sprite.destroy();
  }
}
