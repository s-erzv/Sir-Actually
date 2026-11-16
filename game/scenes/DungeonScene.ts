import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { TILE_SIZE, TILE_SPACING, TileCode,
         GROUND_LAYER_TILES, WALL_LAYER_TILES, DECOR_LAYER_TILES } from "@/game/map/tiles";
import {
  FRAME_WALL_TOP, FRAME_WALL_FACE,
  FRAME_BANNER_RED, FRAME_DOOR_LOCKED, FRAME_DOOR_OPEN,
  FRAME_STAIRS, FRAME_PROP, FRAME_FLOOR, floorAltFrame, wallDecorFrame,
  FLOOR_SHEET_KEY, dungeonFloorFrame,
} from "@/game/map/tileFrames";
import type { DungeonDimension, FloorMap, Room } from "@/lib/domain/types";
import { Player } from "@/game/entities/Player";
import { Monster } from "@/game/entities/Monster";
import {
  playSfx,
  startAmbience,
  startMusic,
  stopAmbience,
  stopMusic,
  toggleMute,
} from "@/game/audio";
import { lootSpotsForFloor } from "@/lib/dungeon/lootSpots";

// ---------------------------------------------------------------------------
// Frame lookup: TileCode → sprite frame index in tilemap.png
// ---------------------------------------------------------------------------

/**
 * Returns the frame index for a given TileCode.
 * FLOOR_ALT and WALL_DECOR/BANNER_RED are placed deterministically by the
 * generator so we just need a default here for the layer renderer.
 */
function tileCodeToFrame(code: TileCode, col: number, _row: number): number {
  switch (code) {
    case TileCode.FLOOR:       return FRAME_FLOOR;
    case TileCode.FLOOR_ALT:   return floorAltFrame(col);
    case TileCode.WALL_TOP:    return FRAME_WALL_TOP;
    case TileCode.WALL_FACE:   return FRAME_WALL_FACE;
    case TileCode.WALL_DECOR:  return wallDecorFrame(col, false);
    case TileCode.BANNER_RED:  return FRAME_BANNER_RED;
    case TileCode.DOOR_LOCKED: return FRAME_DOOR_LOCKED;
    case TileCode.DOOR_OPEN:   return FRAME_DOOR_OPEN;
    case TileCode.STAIRS:      return FRAME_STAIRS;
    case TileCode.PROP:        return FRAME_PROP[col % FRAME_PROP.length] ?? FRAME_PROP[0];
    default:                   return -1;
  }
}

const DIMENSION_TINT: Record<DungeonDimension, number> = {
  gap: 0x8fbd72,
  align: 0x6fb6c5,
  method: 0x8f95d9,
  audit: 0xe9b85d,
  ghost: 0x9fe3d8,
  throne: 0xcf5c68,
};

/** Calculate integer camera zoom that fills the viewport without black bars. */
function calcZoom(viewW: number, viewH: number): number {
  const tilesWide = 20;
  const tilesHigh = 12;
  return Math.max(1, Math.floor(Math.min(viewW / (tilesWide * TILE_SIZE), viewH / (tilesHigh * TILE_SIZE))));
}

export class DungeonScene extends Phaser.Scene {
  private floorMap!: FloorMap;
  private player!: Player;
  private monsters: Monster[] = [];
  private loot: Array<{ sprite: Phaser.GameObjects.Image; x: number; y: number; key: string }> = [];

  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private decorLayer!: Phaser.Tilemaps.TilemapLayer;

  // Keep bus off-handlers for clean shutdown
  private busOff: Array<() => void> = [];
  private minZoom = 1;
  private maxZoom = 6;
  private encounterActive = false;
  private worldPaused = false;
  private lastPlayerTileKey = "";
  private darkness: Phaser.GameObjects.Image | null = null;

  constructor(key = "DungeonScene") {
    super({ key });
  }

  // FloorMap is passed via the Phaser registry (set in PhaserGame.tsx before scene starts).
  init(): void {
    const map = this.game.registry.get("floorMap") as FloorMap | undefined;
    if (!map) throw new Error("DungeonScene: floorMap not found in registry");
    this.floorMap = map;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#080b10");
    this.buildTilemap();
    this.addLoot();
    this.decorateRooms();
    this.addAmbientLights();
    this.addCorridorLights();
    this.addDust();
    this.spawnEntities();
    this.addDarkness();
    this.emitPlayerTile();
    this.emitRoomProgress();
    this.setupCamera();
    this.listenBus();
    this.listenResize();
    this.setupAudio();
    this.cameras.main.fadeIn(420, 3, 5, 8);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
  }

  // ---------------------------------------------------------------------------
  // Tilemap — 3 layers: ground / walls / decor
  // ---------------------------------------------------------------------------

  private buildTilemap(): void {
    const { tiles, width, height } = this.floorMap;

    this.tilemap = this.make.tilemap({
      width,
      height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    // margin=0 (no outer border on the sheet), spacing=1 (1px gap between tiles)
    const tileset = this.tilemap.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE, 0, TILE_SPACING);
    if (!tileset) throw new Error("DungeonScene: tileset 'tiles' failed to load");

    // Floors live on their own seamless interior sheet; walls and props stay
    // on the Kenney atlas. Two tilesets keep both mappings honest.
    const floorTileset = this.tilemap.addTilesetImage(
      FLOOR_SHEET_KEY,
      FLOOR_SHEET_KEY,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );
    if (!floorTileset) throw new Error("DungeonScene: floor tileset failed to load");

    // Create three blank layers
    const groundLayer = this.tilemap.createBlankLayer("ground", floorTileset, 0, 0);
    const wallLayer   = this.tilemap.createBlankLayer("walls",  tileset, 0, 0);
    const decorLayer  = this.tilemap.createBlankLayer("decor",  tileset, 0, 0);
    if (!groundLayer || !wallLayer || !decorLayer) {
      throw new Error("DungeonScene: failed to create tilemap layers");
    }
    this.groundLayer = groundLayer;
    this.wallLayer   = wallLayer;
    this.decorLayer  = decorLayer;
    this.groundLayer.setDepth(0);
    this.wallLayer.setDepth(1);
    this.decorLayer.setDepth(2);

    // Populate layers tile by tile
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const code = (tiles[row]?.[col] ?? TileCode.VOID) as TileCode;
        if (code === TileCode.VOID) continue;

        const onGround = GROUND_LAYER_TILES.has(code);
        const frame = onGround
          ? dungeonFloorFrame(col, code === TileCode.FLOOR_ALT)
          : tileCodeToFrame(code, col, row);
        if (frame < 0) continue;

        if (onGround) {
          this.tilemap.putTileAt(frame, col, row, false, groundLayer);
        } else if (WALL_LAYER_TILES.has(code)) {
          const t = this.tilemap.putTileAt(frame, col, row, false, wallLayer);
          if (t) t.setCollision(true);
        } else if (DECOR_LAYER_TILES.has(code)) {
          const t = this.tilemap.putTileAt(frame, col, row, false, decorLayer);
          if (t) {
            // DOOR_LOCKED blocks movement; others are decorative
            t.setCollision(code === TileCode.DOOR_LOCKED || code === TileCode.PROP);
          }
        }

        // Tag all tiles with their TileCode for runtime queries
        const tagLayer = WALL_LAYER_TILES.has(code) ? wallLayer
          : DECOR_LAYER_TILES.has(code) ? decorLayer : groundLayer;
        const tagTile = this.tilemap.getTileAt(col, row, false, tagLayer);
        if (tagTile) (tagTile as unknown as { properties: { code: TileCode } }).properties = { code };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ambience — coloured room lights, torches, dust
  // ---------------------------------------------------------------------------

  private addAmbientLights(): void {
    const tint = DIMENSION_TINT[this.floorMap.dimension ?? "gap"] ?? DIMENSION_TINT.gap;

    for (const room of this.floorMap.rooms) {
      const cx = (room.rect.x + room.rect.width / 2) * TILE_SIZE;
      const cy = (room.rect.y + room.rect.height / 2) * TILE_SIZE;

      const light = this.add
        .image(cx, cy, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(room.isBoss ? 0xcf5c68 : tint)
        .setAlpha(room.isBoss ? 0.32 : 0.22)
        .setDepth(3);
      light.setDisplaySize(
        room.rect.width * TILE_SIZE * 1.7,
        room.rect.height * TILE_SIZE * 1.7,
      );
      this.tweens.add({
        targets: light,
        alpha: light.alpha * 0.68,
        duration: 1600 + Math.random() * 1400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      for (const tileX of [room.rect.x + 1, room.rect.x + room.rect.width - 1]) {
        const torch = this.add
          .image(tileX * TILE_SIZE, (room.rect.y + 0.4) * TILE_SIZE, "glow-small")
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(room.isBoss ? 0xff5a4a : 0xffb45e)
          .setAlpha(0.55)
          .setDepth(3);
        torch.setDisplaySize(TILE_SIZE * 3.4, TILE_SIZE * 3.4);
        this.tweens.add({
          targets: torch,
          alpha: 0.28,
          duration: 420 + Math.random() * 320,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        if (this.textures.exists("fx-flame")) {
          const flame = this.add
            .sprite(
              tileX * TILE_SIZE + TILE_SIZE * 0.5,
              (room.rect.y + 0.72) * TILE_SIZE,
              "fx-flame",
            )
            .setOrigin(0.5, 1)
            .setScale(1.05)
            .setTint(room.isBoss ? 0xff8a6a : 0xffc06a)
            .setDepth(3.4);
          flame.play("fx-flame-loop");
          this.tweens.add({
            targets: flame,
            alpha: { from: 1, to: 0.72 },
            duration: 120 + Math.random() * 90,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      }
    }
  }

  /** Sparse torches along corridors so halls read as lit stone, not void. */
  private addCorridorLights(): void {
    const { tiles, rooms, width, height, dimension } = this.floorMap;
    const tint = DIMENSION_TINT[dimension ?? "gap"] ?? DIMENSION_TINT.gap;
    const inRoom = (x: number, y: number) =>
      rooms.some(
        (room) =>
          x >= room.rect.x &&
          x < room.rect.x + room.rect.width &&
          y >= room.rect.y &&
          y < room.rect.y + room.rect.height,
      );

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (tiles[y]?.[x] !== TileCode.FLOOR) continue;
        if (inRoom(x, y)) continue;
        if ((x * 13 + y * 7) % 11 !== 0) continue;

        const light = this.add
          .image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, "glow-small")
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(tint)
          .setAlpha(0.22)
          .setDepth(3);
        light.setDisplaySize(TILE_SIZE * 2.6, TILE_SIZE * 2.6);
        this.tweens.add({
          targets: light,
          alpha: 0.1,
          duration: 900 + ((x * 37 + y * 17) % 800),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  private addDust(): void {    const worldW = this.floorMap.width * TILE_SIZE;
    const worldH = this.floorMap.height * TILE_SIZE;
    const tint = DIMENSION_TINT[this.floorMap.dimension ?? "gap"] ?? 0xe9b85d;

    for (let index = 0; index < 32; index += 1) {
      const x = 16 + Math.random() * Math.max(16, worldW - 32);
      const y = 16 + Math.random() * Math.max(16, worldH - 32);
      const dust = this.add
        .image(x, y, "dust")
        .setDepth(9)
        .setAlpha(0.12 + Math.random() * 0.32)
        .setTint(index % 4 === 0 ? 0xffffff : tint);

      this.tweens.add({
        targets: dust,
        y: y - 18 - Math.random() * 32,
        alpha: 0,
        duration: 3200 + Math.random() * 4200,
        delay: Math.random() * 3200,
        repeat: -1,
        repeatDelay: Math.random() * 1200,
        ease: "Sine.easeOut",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------------

  private spawnEntities(): void {
    const { playerSpawn, rooms } = this.floorMap;
    const characterSlug = this.game.registry.get("characterSlug") as string | undefined;

    this.player = new Player(
      this,
      playerSpawn.x * TILE_SIZE + TILE_SIZE / 2,
      playerSpawn.y * TILE_SIZE + TILE_SIZE / 2,
      this.decorLayer,
      this.floorMap,
      characterSlug,
    );

    this.monsters = [];
    for (const room of rooms) {
      this.spawnRoomMonsters(room);
    }

    const resolvedKeys = new Set(
      (this.game.registry.get("resolvedKeys") as string[] | undefined) ?? [],
    );
    if (resolvedKeys.size > 0) {
      for (const monster of this.monsters) {
        if (resolvedKeys.has(monster.encounterKey)) monster.markResolvedImmediate();
      }
    }
    // Floors with no minions (Ghost/Throne) must open the boss gate immediately.
    this.unlockBossDoorIfCleared(false);
  }

  /** The boss door stays shut until every minion on the floor is resolved. */
  private unlockBossDoorIfCleared(announce = true): void {
    if (this.monsters.some((monster) => !monster.isBoss && !monster.resolved)) return;
    const bossRoom = this.floorMap.rooms.find((room) => room.isBoss);
    if (!bossRoom?.entranceDoor) return;
    const { x, y } = bossRoom.entranceDoor;
    if (this.floorMap.tiles[y]?.[x] !== TileCode.DOOR_LOCKED) return;
    this.unlockDoor(x, y);
    if (announce) {
      bus.emit("door:opened", { roomNumber: this.floorMap.rooms.indexOf(bossRoom) + 1 });
      playSfx("doorOpen");
      this.cameras.main.flash(180, 255, 200, 120, false);
    }
  }

  /** Give every room its own palette (floor tint + rug) so the dungeon stops looking uniform. */
  private decorateRooms(): void {
    const PALETTES = [0xf2f6ff, 0xf2fff2, 0xfff6e6, 0xf6f2ff, 0xeefffc, 0xfff2f5];
    const RUGS = [0x5a1f28, 0x1f3d55, 0x32551f, 0x4a2455, 0x554a1f, 0x1f554c];
    this.floorMap.rooms.forEach((room, index) => {
      const { x, y, width, height } = room.rect;
      const tint = room.isBoss ? 0xffd8d8 : PALETTES[index % PALETTES.length]!;
      for (let ty = y; ty < y + height; ty++) {
        for (let tx = x; tx < x + width; tx++) {
          const tile = this.tilemap.getTileAt(tx, ty, false, this.groundLayer);
          if (tile) tile.tint = tint;
        }
      }
      if (width < 6 || height < 5) return;
      const rugColor = room.isBoss ? 0x7a1f2b : RUGS[index % RUGS.length]!;
      const rx = (x + 2) * TILE_SIZE, ry = (y + 2) * TILE_SIZE;
      const rw = (width - 4) * TILE_SIZE, rh = (height - 4) * TILE_SIZE;
      this.add.rectangle(rx + rw / 2, ry + rh / 2, rw, rh, rugColor, 0.55).setDepth(0.5)
        .setStrokeStyle(2, 0xd9b45f, 0.7);
      this.add.rectangle(rx + rw / 2, ry + rh / 2, rw - 6, rh - 6).setDepth(0.5)
        .setStrokeStyle(1, 0xd9b45f, 0.4);
    });
  }

  private floorMusic() {
    const dimension = this.floorMap.dimension;
    return dimension === "ghost" || dimension === "throne" ? "crypt" as const : "dungeon" as const;
  }

  private setupAudio(): void {
    startAmbience();
    startMusic(this.floorMusic());
    const mute = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mute?.on("down", () => toggleMute());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopAmbience();
      stopMusic();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      stopAmbience();
      stopMusic();
    });
  }

  /** Loot from the shared deterministic placement; server validates the same keys. */
  private addLoot(): void {
    const spots = lootSpotsForFloor(this.floorMap);
    spots.forEach((spot, index) => {
      const sprite = this.add
        .image(spot.x * TILE_SIZE + TILE_SIZE / 2, spot.y * TILE_SIZE + TILE_SIZE / 2, "rl", spot.frame)
        .setDepth(1.5);
      this.loot.push({ sprite, x: spot.x, y: spot.y, key: spot.key });
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 3,
        duration: 900 + ((index * 137) % 700),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  private collectLootAt(tile: { x: number; y: number }): void {
    const index = this.loot.findIndex((item) => item.x === tile.x && item.y === tile.y);
    if (index < 0) return;
    const [item] = this.loot.splice(index, 1);
    if (!item) return;

    playSfx("pickup");
    bus.emit("loot:collected", { key: item.key });
    this.tweens.killTweensOf(item.sprite);
    this.tweens.add({
      targets: item.sprite,
      y: item.sprite.y - 14,
      alpha: 0,
      scale: 1.5,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => item.sprite.destroy(),
    });

    const label = this.add
      .text(item.sprite.x, item.sprite.y - 8, "+loot", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e9b85d",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: label,
      y: label.y - 16,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  /** Tell the HUD how many monsters remain in the next room that still has any. */
  private emitRoomProgress(): void {
    const rooms = this.floorMap.rooms;
    for (let i = 0; i < rooms.length; i++) {
      const inRoom = this.monsters.filter((m) => m.roomId === rooms[i]!.id);
      const remaining = inRoom.filter((m) => !m.resolved).length;
      if (remaining > 0) {
        bus.emit("room:progress", { roomNumber: i + 1, remaining, total: inRoom.length });
        return;
      }
    }
    bus.emit("room:progress", null);
  }

  private spawnRoomMonsters(room: Room): void {
    const hasMonster =
      room.kind === "special" ||
      Boolean(room.findingId) ||
      (room.findingIds?.length ?? 0) > 0;
    // Empty maze chambers are corridors/dead ends, not encounters.
    if (!hasMonster) return;
    const spawns = room.monsterSpawns?.length ? room.monsterSpawns : [room.monsterSpawn];
    spawns.forEach((spawn, index) => {
      const findingId = room.findingIds?.[index] ?? room.findingId;
      const meta = findingId ? this.floorMap.findingMeta?.[findingId] : undefined;
      const monster = new Monster(
        this,
        spawn.x * TILE_SIZE + TILE_SIZE / 2,
        spawn.y * TILE_SIZE + TILE_SIZE / 2,
        room.isBoss,
        room,
        this.floorMap.floorOrder,
        meta,
        {
          findingId,
          bossSlug: room.kind === "minions" ? undefined : room.bossSlug,
          weaknessType: meta?.weaknessType,
          evidenceQuote: meta?.evidenceQuote,
        },
        index,
      );
      this.monsters.push(monster);
    });
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  /** Torchlight: everything beyond a few tiles of the player falls to black. */
  private addDarkness(): void {
    if (!this.textures.exists("darkness")) return;
    const size = 2400; // world px; covers the view at the widest zoom
    this.darkness = this.add
      .image(this.player.sprite.x, this.player.sprite.y, "darkness")
      .setDisplaySize(size, size)
      .setDepth(50);
    // Slow flicker so the light feels like a flame, not a spotlight.
    this.tweens.add({
      targets: this.darkness,
      displayWidth: size * 1.04,
      displayHeight: size * 1.04,
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private setupCamera(): void {
    const { width, height } = this.floorMap;
    const baseZoom = calcZoom(this.scale.width, this.scale.height);
    this.minZoom = Math.max(1, baseZoom - 1);
    this.maxZoom = Math.min(9, baseZoom + 3);
    this.cameras.main.setZoom(baseZoom);
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    this.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        this.zoomBy(dy > 0 ? -0.5 : 0.5);
      },
    );
  }

  private zoomBy(delta: number): void {
    const next = Phaser.Math.Clamp(
      Math.round((this.cameras.main.zoom + delta) * 2) / 2,
      this.minZoom,
      this.maxZoom,
    );
    if (Math.abs(next - this.cameras.main.zoom) < 0.01) return;
    this.tweens.add({
      targets: this.cameras.main,
      zoom: next,
      duration: 140,
      ease: "Sine.easeOut",
    });
  }

  private listenResize(): void {
    const onResize = () => {
      const baseZoom = calcZoom(this.scale.width, this.scale.height);
      this.minZoom = Math.max(1, baseZoom - 1);
      this.maxZoom = Math.min(9, baseZoom + 3);
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(this.cameras.main.zoom, this.minZoom, this.maxZoom),
      );
    };
    this.scale.on("resize", onResize);
    this.busOff.push(() => this.scale.off("resize", onResize));
  }

  // ---------------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------------

  private listenBus(): void {
    const onEncounterStart = () => {
      this.encounterActive = true;
      playSfx("encounter");
      startMusic("fight");
    };

    const onEncounterEnd = ({ encounterId, result }: { encounterId: string; result: "won" | "conceded" | "disputed" | "fled" }) => {
      this.encounterActive = false;
      const monster = this.monsters.find((m) => m.encounterId === encounterId);
      if (!monster) return;
      playSfx(result === "won" ? "win" : "lose");
      monster.markResolved(result);
      if (result === "won") {
        this.cameras.main.shake(monster.isBoss ? 420 : 220, monster.isBoss ? 0.012 : 0.006);
        this.cameras.main.flash(monster.isBoss ? 260 : 140, 255, 220, 150, false);
      }

      startMusic(this.floorMusic());
      this.unlockBossDoorIfCleared();
      this.emitRoomProgress();
    };

    const onBossHit = ({
      encounterId,
      damage,
      heartLost,
    }: {
      encounterId: string;
      damage: number;
      heartLost?: boolean;
    }) => {
      const monster = this.monsters.find((m) => m.encounterId === encounterId);
      if (!monster) return;
      const playerAt = { x: this.player.sprite.x, y: this.player.sprite.y };
      const monsterAt = { x: monster.sprite.x, y: monster.sprite.y };

      this.player.attack(monsterAt.x, monsterAt.y);
      // The blow lands at the end of the lunge.
      this.time.delayedCall(70, () => {
        playSfx(damage > 0 ? "hit" : "miss");
        monster.playHit(this, damage, playerAt);
        if (damage > 0) {
          this.cameras.main.shake(damage >= 35 ? 160 : 90, damage >= 35 ? 0.008 : 0.004);
          this.hitStop(damage >= 35 ? 90 : 50);
        }
      });

      if (heartLost) {
        this.time.delayedCall(420, () => {
          monster.playCounter(this, playerAt);
          this.time.delayedCall(90, () => {
            playSfx("hurt");
            this.player.hurt(monsterAt.x, monsterAt.y);
            this.cameras.main.shake(200, 0.01);
            this.cameras.main.flash(160, 190, 30, 30, false);
          });
        });
      }
    };

    const onFloorRetry = () => {
      this.retryFloor();
    };

    const onZoom = ({ delta }: { delta: number }) => {
      this.zoomBy(delta);
    };

    const onGamePause = () => {
      this.worldPaused = true;
    };

    const onGameResume = () => {
      this.worldPaused = false;
    };

    const onPlayerStep = ({ dir }: { dir: "up" | "down" | "left" | "right" }) => {
      this.player.step(dir, this.monsters);
    };

    bus.on("encounter:start", onEncounterStart);
    bus.on("encounter:end", onEncounterEnd);
    bus.on("boss:hit", onBossHit);
    bus.on("floor:retry", onFloorRetry);
    bus.on("camera:zoom", onZoom);
    bus.on("game:pause", onGamePause);
    bus.on("game:resume", onGameResume);
    bus.on("player:step", onPlayerStep);

    this.busOff.push(
      () => bus.off("encounter:start", onEncounterStart),
      () => bus.off("encounter:end", onEncounterEnd),
      () => bus.off("boss:hit", onBossHit),
      () => bus.off("floor:retry", onFloorRetry),
      () => bus.off("camera:zoom", onZoom),
      () => bus.off("game:pause", onGamePause),
      () => bus.off("game:resume", onGameResume),
      () => bus.off("player:step", onPlayerStep),
    );
  }

  /** Freeze tweens for a few frames so a hit reads as impact. */
  private hitStop(ms: number): void {
    this.tweens.timeScale = 0.05;
    window.setTimeout(() => {
      if (this.sys.isActive()) this.tweens.timeScale = 1;
    }, ms);
  }

  private unlockDoor(tileX: number, tileY: number): void {
    const tile = this.tilemap.getTileAt(tileX, tileY, false, this.decorLayer);
    if (!tile) return;

    // Tween the tile alpha down (gate "rising"), then swap to floor frame
    this.tweens.add({
      targets: tile,
      alpha: 0,
      duration: 200,
      ease: "Linear",
      onComplete: () => {
        tile.index = FRAME_DOOR_OPEN;
        tile.setCollision(false);
        tile.alpha = 1;
      },
    });

    // Update logical tile array
    this.floorMap.tiles[tileY]![tileX] = TileCode.DOOR_OPEN;
  }

  // ---------------------------------------------------------------------------
  // Floor retry — respawn all monsters, relock doors, reset player position
  // ---------------------------------------------------------------------------

  private startEncounter(monster: Monster): void {
    if (this.encounterActive || monster.resolved) return;
    this.encounterActive = true;
    bus.emit("encounter:start", {
      encounterId: monster.encounterId,
      encounterKey: monster.encounterKey,
      findingId: monster.findingId,
      bossSlug: monster.bossSlug,
      floor: monster.floor,
      room: monster.roomIndex,
      isBoss: monster.isBoss,
      weaknessType: monster.weaknessType,
      evidenceQuote: monster.evidenceQuote,
    });
  }

  private retryFloor(): void {
    this.encounterActive = false;
    // Destroy all existing monster sprites
    for (const m of this.monsters) m.destroy();
    this.monsters = [];

    // Relock only the boss gate; maze branches stay open.
    const bossRoom = this.floorMap.rooms.find((room) => room.isBoss);
    if (bossRoom?.entranceDoor) {
      const { x, y } = bossRoom.entranceDoor;
      const tile = this.tilemap.getTileAt(x, y, false, this.decorLayer);
      if (tile) {
        tile.index = FRAME_DOOR_LOCKED;
        tile.setCollision(true);
        tile.alpha = 1;
      }
      this.floorMap.tiles[y]![x] = TileCode.DOOR_LOCKED;
    }

    // Respawn monsters
    for (const room of this.floorMap.rooms) {
      this.spawnRoomMonsters(room);
    }
    this.unlockBossDoorIfCleared(false);
    this.emitRoomProgress();

    // Teleport player back to spawn
    const { playerSpawn } = this.floorMap;
    this.player.teleport(playerSpawn.x, playerSpawn.y);
    this.lastPlayerTileKey = "";
    this.emitPlayerTile();
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  private emitPlayerTile(): void {
    const tile = this.player.getTile();
    const key = `${tile.x},${tile.y}`;
    if (key === this.lastPlayerTileKey) return;
    this.lastPlayerTileKey = key;
    bus.emit("player:moved", tile);
  }

  update(): void {
    this.player.update(this.monsters);
    this.darkness?.setPosition(this.player.sprite.x, this.player.sprite.y);
    this.emitPlayerTile();
    if (!this.encounterActive && !this.worldPaused) {
      this.collectLootAt(this.player.getTile());
    }
    if (this.encounterActive || this.worldPaused) return;

    const playerTile = this.player.getTile();
    const activeMonsters = this.monsters.filter((monster) => !monster.resolved);
    const occupied = new Set(activeMonsters.map((monster) => `${monster.tileX},${monster.tileY}`));
    for (const monster of activeMonsters) {
      const previousKey = `${monster.tileX},${monster.tileY}`;
      monster.updateChase(playerTile, this.floorMap, occupied);
      const nextKey = `${monster.tileX},${monster.tileY}`;
      if (nextKey !== previousKey) {
        occupied.delete(previousKey);
        occupied.add(nextKey);
      }
    }

    const caught = activeMonsters.find(
      (monster) => monster.tileX === playerTile.x && monster.tileY === playerTile.y,
    );
    if (caught) this.startEncounter(caught);
  }

  // ---------------------------------------------------------------------------
  // Shutdown — clean up bus listeners
  // ---------------------------------------------------------------------------

  shutdown(): void {
    for (const off of this.busOff) off();
    this.busOff = [];
  }
}
