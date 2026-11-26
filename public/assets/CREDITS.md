# Asset Credits

All third-party assets used in this project are listed here with their source
and license. Only CC0 (Creative Commons Zero) assets are used.

---

## Kenney Tiny Dungeon

- **Name**: Tiny Dungeon (v1.0)
- **Author**: Kenney (www.kenney.nl)
- **Source**: https://kenney-assets.itch.io/tiny-dungeon
- **License**: Creative Commons Zero (CC0) — https://creativecommons.org/publicdomain/zero/1.0/
- **Files**: `public/assets/tiny-dungeon/`
- **Contents**: 132 tiles (stone walls, floors, doors, stairs, torches, characters,
  items, weapons). Original spritesheets: `tilemap.png` (with 1 px spacing) and
  `tilemap_packed.png` (no spacing).
- **Derivative**: `Tilemap/tilemap-2bit.png` is an optional four-colour recolor that
  preserves frame geometry and transparency. The game ships with the original
  colourful `Tilemap/tilemap.png` atlas.

**Confirmed tile specifications (from `Tilesheet.txt` + `Tiled/sampleSheet.tsx`):**

| Property | Value |
|---|---|
| Tile size | 16 × 16 px |
| Spacing between tiles | 1 px |
| Sheet columns | 12 |
| Sheet rows | 11 |
| Total tiles | 132 |
| Spritesheet image size | 203 × 186 px |

**Frame mapping used in `game/map/tiles.ts`:**

| Role | Frame index | Description |
|---|---|---|
| WALL | 0 | Solid stone wall |
| FLOOR | 2 | Stone floor |
| DOOR_LOCKED | 25 | Closed door |
| DOOR_OPEN | 26 | Open door |
| STAIRS | 13 | Stairs down |
| TORCH | 24 | Orange torch |
| TORCH_RED | 36 | Red torch (boss rooms) |
| DECOR | 3 | Cracked stone |
| Player | 84 | Knight character |
| Minion | 90 | Skeleton enemy |
| Boss | 96 | Armored enemy |

---

*This file must be updated whenever a new asset is added to `public/assets/`.*
*Do not add assets with unclear or non-CC0 licenses.*

---

## Kenney Roguelike Pack

- **Author**: Kenney Vleugels for Kenney (www.kenney.nl)
- **Source**: https://opengameart.org/content/roguelikerpg-pack-1700-tiles
- **License**: CC0
- **Files**: `public/assets/roguelike/` (16×16 tiles, 1 px spacing, 57 columns)
- **Used for**: loot/props scattered in rooms (`DungeonScene.addLoot`)

## Kenney Pixel UI Pack

- **Author**: Kenney (www.kenney.nl)
- **Source**: https://opengameart.org/content/pixel-ui-pack-750-assets
- **License**: CC0
- **Files**: `public/assets/pixel-ui/` (downloaded, not yet wired into the UI)

## Ninja Adventure Asset Pack

- **Author**: Pixel-Boy and AAA
- **Source**: https://pixel-boy.itch.io/ninja-adventure-asset-pack (files taken from the
  author's repository, https://github.com/pixel-boy/NinjaAdventure)
- **License**: CC0
- **Files**:
  - `public/assets/ninja-adventure/characters/` (64x112 sheets, 16x16 frames:
    columns down/up/left/right, rows 0-3 walk, row 4 attack) — animated player
    characters (`lib/sprites/sheets.ts`).
  - `public/assets/ninja-adventure/monsters/` and `bosses/` — monster idle/walk/hit
    sheets (`lib/sprites/monsters.ts`).
  - `public/assets/ninja-adventure/portraits/` and `faces/` — character and monster
    portraits (`components/brand/Portrait.tsx`). `faces-transparent/` contains the
    same face sprites with the opaque backdrop keyed out for UI use.
  - `public/assets/ninja-adventure/items/` — chest and potion sprites (`DungeonScene`).
  - `public/assets/ninja-adventure/fx/` — arrow, shield, slash, flame and cut effects
    (`Player` attack styles, monster hits).
  - `public/assets/ninja-adventure/audio/music/` and `audio/sfx/` — floor/fight music
    and sound effects (`game/audio.ts`).
