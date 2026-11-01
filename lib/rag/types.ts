export interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  sectionLabel: string | null;
  text: string;
  score: number;
  source: "fts" | "vector" | "debug";
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  strategy: "fts" | "vector" | "hybrid" | "none";
  insufficientEvidence: boolean;
  warnings: string[];
}

export interface RagRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
