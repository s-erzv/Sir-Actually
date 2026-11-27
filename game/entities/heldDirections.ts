export type Direction = "up" | "down" | "left" | "right";

/**
 * Held direction keys, newest first. The newest key wins, so rolling from
 * Up to Right turns right at once instead of waiting for Up to be released.
 */
export function pushHeld(held: Direction[], dir: Direction): Direction[] {
  return [dir, ...held.filter((item) => item !== dir)];
}

export function releaseHeld(held: Direction[], dir: Direction): Direction[] {
  return held.filter((item) => item !== dir);
}
