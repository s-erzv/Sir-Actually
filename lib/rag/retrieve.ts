import { embedTexts } from "@/lib/embed";
import { rrfMerge } from "./rrf";
import type { RagRpcClient, RetrievalResult, RetrievedChunk } from "./types";

export interface RetrieveInput {
  manuscriptId: string;
  version: number;
  query: string;
  limit?: number;
  embedQuery?: (text: string) => Promise<{ model: string; vector: number[] } | null>;
}

function cleanQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 1200);
}

async function defaultEmbedQuery(text: string): Promise<{ model: string; vector: number[] } | null> {
  const result = await embedTexts([text]);
  const vector = result?.vectors[0];
  if (!result || !vector) return null;
  return { model: result.model, vector };
}

async function searchFts(
  client: RagRpcClient,
  input: RetrieveInput,
  query: string,
): Promise<RetrievedChunk[]> {
  const { data, error } = await client.rpc("search_manuscript_chunks_fts", {
    query_text: query,
    filter_manuscript_id: input.manuscriptId,
    filter_version: input.version,
    match_count: input.limit ?? 6,
  });
  if (error) throw new Error(`Retrieval FTS gagal: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    chunk_index: number;
    section_label: string | null;
    text: string;
    rank: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    chunkIndex: row.chunk_index,
    sectionLabel: row.section_label,
    text: row.text,
    score: row.rank,
    source: "fts",
  }));
}

async function searchVector(
  client: RagRpcClient,
  input: RetrieveInput,
  query: string,
  embedQuery: NonNullable<RetrieveInput["embedQuery"]>,
): Promise<RetrievedChunk[]> {
  const embedded = await embedQuery(query);
  if (!embedded) return [];

  const { data, error } = await client.rpc("match_manuscript_chunks", {
    query_embedding: embedded.vector,
    filter_manuscript_id: input.manuscriptId,
    filter_version: input.version,
    match_count: 20,
    filter_model: embedded.model,
  });
  if (error) throw new Error(`Retrieval vektor gagal: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    chunk_index: number;
    section_label: string | null;
    text: string;
    similarity: number;
  }>;
  return rows
    .filter((row) => row.similarity >= 0.4)
    .map((row) => ({
      id: row.id,
      chunkIndex: row.chunk_index,
      sectionLabel: row.section_label,
      text: row.text,
      score: row.similarity,
      source: "vector" as const,
    }));
}

export async function retrieveChunks(
  client: RagRpcClient,
  input: RetrieveInput,
): Promise<RetrievalResult> {
  const query = cleanQuery(input.query);
  if (!query) {
    return { chunks: [], strategy: "none", insufficientEvidence: true, warnings: [] };
  }

  const warnings: string[] = [];
  let fts: RetrievedChunk[] = [];
  let vector: RetrievedChunk[] = [];

  try {
    fts = await searchFts(client, input, query);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Retrieval FTS gagal.");
  }

  try {
    vector = await searchVector(client, input, query, input.embedQuery ?? defaultEmbedQuery);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Retrieval vektor gagal.");
  }

  let chunks: RetrievedChunk[];
  let strategy: RetrievalResult["strategy"];
  if (fts.length > 0 && vector.length > 0) {
    chunks = rrfMerge([vector, fts], 60, input.limit ?? 6);
    strategy = "hybrid";
  } else if (vector.length > 0) {
    chunks = vector.slice(0, input.limit ?? 6);
    strategy = "vector";
  } else if (fts.length > 0) {
    chunks = fts.slice(0, input.limit ?? 6);
    strategy = "fts";
  } else {
    chunks = [];
    strategy = "none";
  }

  return {
    chunks,
    strategy,
    insufficientEvidence: chunks.length === 0,
    warnings,
  };
}

export function mergeChunks(
  results: readonly RetrievalResult[],
  maxChunks = 24,
): RetrievedChunk[] {
  const byId = new Map<string, { chunk: RetrievedChunk; score: number }>();
  for (const result of results) {
    result.chunks.forEach((chunk, index) => {
      const current = byId.get(chunk.id);
      const addition = 1 / (60 + index + 1);
      if (current) {
        current.score += addition;
      } else {
        byId.set(chunk.id, { chunk, score: addition });
      }
    });
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map((entry) => entry.chunk);
}
