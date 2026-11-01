export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export interface LLMConfig {
  provider: "anthropic" | "openai" | "gemini" | "kagiro";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER ?? "gemini") as LLMConfig["provider"];
  if (!["anthropic", "openai", "gemini", "kagiro"].includes(provider)) {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
  return {
    provider,
    model: requireEnv("LLM_MODEL"),
    apiKey: requireEnv("LLM_API_KEY"),
    baseUrl: process.env.LLM_BASE_URL || undefined,
  };
}

export interface EmbeddingConfig {
  provider: "gemini" | "openai";
  model: string;
  apiKey: string;
  dimensions: number;
}

export function getEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  if (!apiKey || !model || apiKey.startsWith("YOUR_")) return null;
  const provider = (process.env.EMBEDDING_PROVIDER ?? "gemini") as EmbeddingConfig["provider"];
  if (!["gemini", "openai"].includes(provider)) {
    throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
  }
  return {
    provider,
    model,
    apiKey,
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 768),
  };
}
