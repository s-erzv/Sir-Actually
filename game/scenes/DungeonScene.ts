import * as Phaser from "phaser";
import { bus } from "@/game/bus";
import { TILE_SIZE, TILE_SPACING, TileCode,
         GROUND_LAYER_TILES, WALL_LAYER_TILES, DECOR_LAYER_TILES } from "@/game/map/tiles";
import {
  FRAME_WALL_TOP, FRAME_WALL_FACE,
  FRAME_BANNER_RED, FRAME_DOOR_LOCKED, FRAME_DOOR_OPEN,
  FRAME_STAIRS, FRAME_PROP, FRAME_FLOOR, floorAltFrame, wallDecorFrame,
} from "@/game/map/tileFrames";
import type { FloorMap } from "@/lib/domain/types";
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
    this.cameras.main.setBackgroundColor("#0c0e0d");
    this.buildTilemap();
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
  // Entities
  // ---------------------------------------------------------------------------

  private spawnEntities(): void {
    const { playerSpawn, rooms } = this.floorMap;

    this.player = new Player(
      this,
      playerSpawn.x * TILE_SIZE + TILE_SIZE / 2,
      playerSpawn.y * TILE_SIZE + TILE_SIZE / 2,
      this.decorLayer,
      this.floorMap,
    );

    this.monsters = [];
    for (const room of rooms) {
      const monster = new Monster(
        this,
        room.monsterSpawn.x * TILE_SIZE + TILE_SIZE / 2,
        room.monsterSpawn.y * TILE_SIZE + TILE_SIZE / 2,
        room.isBoss,
        room,
        this.floorMap.floorOrder,
        room.findingId ? this.floorMap.findingMeta?.[room.findingId] : undefined,
      );
      this.monsters.push(monster);
    }
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  private setupCamera(): void {
    const { width, height } = this.floorMap;
    const zoom = calcZoom(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
  }

  private listenResize(): void {
    const onResize = () => {
      const zoom = calcZoom(this.scale.width, this.scale.height);
      this.cameras.main.setZoom(zoom);
    };
    this.scale.on("resize", onResize);
    this.busOff.push(() => this.scale.off("resize", onResize));
  }

  // ---------------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------------

  private listenBus(): void {
    const onEncounterEnd = ({ encounterId, result }: { encounterId: string; result: "won" | "conceded" | "disputed" | "fled" }) => {
      const monster = this.monsters.find((m) => m.encounterId === encounterId);
      if (!monster) return;
      monster.markResolved(result);

      const room = this.floorMap.rooms.find((r) => r.id === monster.roomId);
      if (room?.entranceDoor) {
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

    bus.on("encounter:end", onEncounterEnd);
    bus.on("boss:hit", onBossHit);
    bus.on("floor:retry", onFloorRetry);

    this.busOff.push(
      () => bus.off("encounter:end", onEncounterEnd),
      () => bus.off("boss:hit", onBossHit),
      () => bus.off("floor:retry", onFloorRetry),
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

  private retryFloor(): void {
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
      const monster = new Monster(
        this,
        room.monsterSpawn.x * TILE_SIZE + TILE_SIZE / 2,
        room.monsterSpawn.y * TILE_SIZE + TILE_SIZE / 2,
        room.isBoss,
        room,
        this.floorMap.floorOrder,
        room.findingId ? this.floorMap.findingMeta?.[room.findingId] : undefined,
      );
      this.monsters.push(monster);
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
  }

  // ---------------------------------------------------------------------------
  // Shutdown — clean up bus listeners
  // ---------------------------------------------------------------------------

  shutdown(): void {
    for (const off of this.busOff) off();
    this.busOff = [];
  }
}
