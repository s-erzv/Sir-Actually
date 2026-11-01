export interface RankableFinding {
  id: string;
  severity: number;
  centrality: number;
  confidence: number;
}

export function rankFindings<T extends RankableFinding>(findings: T[]): Array<T & { rank: number }> {
  return [...findings]
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      if (b.centrality !== a.centrality) return b.centrality - a.centrality;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.id.localeCompare(b.id);
    })
    .map((finding, index) => ({ ...finding, rank: index + 1 }));
}
