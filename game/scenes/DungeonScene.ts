import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { TILE_SIZE, TILE_SPACING, TileCode,
         GROUND_LAYER_TILES, WALL_LAYER_TILES, DECOR_LAYER_TILES } from "@/game/map/tiles";
import {
  FRAME_WALL_TOP, FRAME_WALL_FACE,
  FRAME_BANNER_RED, FRAME_DOOR_LOCKED, FRAME_DOOR_OPEN,
  FRAME_STAIRS, FRAME_PROP, FRAME_FLOOR, floorAltFrame, wallDecorFrame,
} from "@/game/map/tileFrames";
import type { DungeonDimension, FloorMap, Room } from "@/lib/domain/types";
import { Player } from "@/game/entities/Player";
import { Monster } from "@/game/entities/Monster";

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

  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private decorLayer!: Phaser.Tilemaps.TilemapLayer;

  // Keep bus off-handlers for clean shutdown
  private busOff: Array<() => void> = [];
  private minZoom = 1;
  private maxZoom = 6;
  private encounterActive = false;

  constructor() {
    super({ key: "DungeonScene" });
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
    this.addAmbientLights();
    this.addDust();
    this.spawnEntities();
    this.setupCamera();
    this.listenBus();
    this.listenResize();
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

    // Create three blank layers
    const groundLayer = this.tilemap.createBlankLayer("ground", tileset, 0, 0);
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

        const frame = tileCodeToFrame(code, col, row);
        if (frame < 0) continue;

        if (GROUND_LAYER_TILES.has(code)) {
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
      }
    }
  }

  private addDust(): void {
    const worldW = this.floorMap.width * TILE_SIZE;
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
      for (const room of rooms) {
        const roomMonsters = this.monsters.filter((monster) => monster.roomId === room.id);
        if (
          room.entranceDoor &&
          roomMonsters.length > 0 &&
          roomMonsters.every((monster) => monster.resolved)
        ) {
          this.unlockDoor(room.entranceDoor.x, room.entranceDoor.y);
        }
      }
    }
  }

  private spawnRoomMonsters(room: Room): void {
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
    };

    const onEncounterEnd = ({ encounterId, result }: { encounterId: string; result: "won" | "conceded" | "disputed" | "fled" }) => {
      this.encounterActive = false;
      const monster = this.monsters.find((m) => m.encounterId === encounterId);
      if (!monster) return;
      monster.markResolved(result);

      const room = this.floorMap.rooms.find((r) => r.id === monster.roomId);
      const roomMonsters = this.monsters.filter((m) => m.roomId === monster.roomId);
      if (room?.entranceDoor && roomMonsters.every((m) => m.resolved)) {
        this.unlockDoor(room.entranceDoor.x, room.entranceDoor.y);
      }
    };

    const onBossHit = ({ encounterId, damage }: { encounterId: string; damage: number }) => {
      const monster = this.monsters.find((m) => m.encounterId === encounterId);
      if (!monster) return;
      monster.playHit(this, damage);
    };

    const onFloorRetry = () => {
      this.retryFloor();
    };

    const onZoom = ({ delta }: { delta: number }) => {
      this.zoomBy(delta);
    };

    bus.on("encounter:start", onEncounterStart);
    bus.on("encounter:end", onEncounterEnd);
    bus.on("boss:hit", onBossHit);
    bus.on("floor:retry", onFloorRetry);
    bus.on("camera:zoom", onZoom);

    this.busOff.push(
      () => bus.off("encounter:start", onEncounterStart),
      () => bus.off("encounter:end", onEncounterEnd),
      () => bus.off("boss:hit", onBossHit),
      () => bus.off("floor:retry", onFloorRetry),
      () => bus.off("camera:zoom", onZoom),
    );
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

    // Relock all doors
    for (const room of this.floorMap.rooms) {
      if (room.entranceDoor) {
        const { x, y } = room.entranceDoor;
        const tile = this.tilemap.getTileAt(x, y, false, this.decorLayer);
        if (tile) {
          tile.index = FRAME_DOOR_LOCKED;
          tile.setCollision(true);
          tile.alpha = 1;
        }
        this.floorMap.tiles[y]![x] = TileCode.DOOR_LOCKED;
      }
    }

    // Keep first corridor door (room 0) open
    const firstRoom = this.floorMap.rooms[0];
    if (firstRoom?.entranceDoor) {
      const { x, y } = firstRoom.entranceDoor;
      const tile = this.tilemap.getTileAt(x, y, false, this.decorLayer);
      if (tile) { tile.index = FRAME_DOOR_OPEN; tile.setCollision(false); }
      this.floorMap.tiles[y]![x] = TileCode.DOOR_OPEN;
    }

    // Respawn monsters
    for (const room of this.floorMap.rooms) {
      this.spawnRoomMonsters(room);
    }

    // Teleport player back to spawn
    const { playerSpawn } = this.floorMap;
    this.player.teleport(playerSpawn.x, playerSpawn.y);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(): void {
    this.player.update(this.monsters);
    if (this.encounterActive) return;

    const playerTile = this.player.getTile();
    const activeMonsters = this.monsters.filter((monster) => !monster.resolved);
    const occupied = new Set(activeMonsters.map((monster) => `${monster.tileX},${monster.tileY}`));
    for (const monster of activeMonsters) {
      monster.updateChase(playerTile, this.floorMap, occupied);
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
