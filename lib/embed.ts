import { getEmbeddingConfig } from "@/lib/env";

export interface EmbeddingResult {
  model: string;
  vectors: number[][];
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult | null> {
  const config = getEmbeddingConfig();
  if (!config) return null;
  if (texts.length === 0) return { model: config.model, vectors: [] };

  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
        dimensions: config.dimensions,
      }),
    });
    const data = (await readJson(response)) as {
      data?: Array<{ embedding: number[] }>;
    };
    const vectors = (data.data ?? []).map((item) => item.embedding);
    if (vectors.length !== texts.length) {
      throw new Error("Respons embedding tidak lengkap.");
    }
    return { model: config.model, vectors };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:batchEmbedContents?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${config.model}`,
          content: { parts: [{ text }] },
          outputDimensionality: config.dimensions,
        })),
      }),
    },
  );
  const data = (await readJson(response)) as {
    embeddings?: Array<{ values: number[] }>;
  };
  const vectors = (data.embeddings ?? []).map((item) => item.values);
  if (vectors.length !== texts.length) {
    throw new Error("Respons embedding tidak lengkap.");
  }
  return { model: config.model, vectors };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Embedding ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}
