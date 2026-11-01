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
  items, weapons). Two spritesheets: `tilemap.png` (with 1 px spacing) and
  `tilemap_packed.png` (no spacing).

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
