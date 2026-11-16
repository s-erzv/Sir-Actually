/** Fog-of-war helpers shared by the minimap. */
export function revealedTileKeys(
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): string[] {
  const keys: string[] = [];
  for (let ty = y - radius; ty <= y + radius; ty += 1) {
    for (let tx = x - radius; tx <= x + radius; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      keys.push(`${tx},${ty}`);
    }
  }
  return keys;
}

export function isExplored(
  explored: ReadonlySet<string>,
  x: number,
  y: number,
): boolean {
  return explored.has(`${x},${y}`);
}
