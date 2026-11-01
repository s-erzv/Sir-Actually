export function rrfMerge<T extends { id: string }>(
  lists: ReadonlyArray<readonly T[]>,
  k = 60,
  limit = 24,
): T[] {
  const scores = new Map<string, { item: T; score: number }>();
  for (const list of lists) {
    list.forEach((item, index) => {
      const current = scores.get(item.id);
      const addition = 1 / (k + index + 1);
      if (current) {
        current.score += addition;
      } else {
        scores.set(item.id, { item, score: addition });
      }
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
