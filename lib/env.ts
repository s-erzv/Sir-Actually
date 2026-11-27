export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export interface LLMConfig {
  provider: "anthropic" | "openai" | "gemini" | "openrouter";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/** DeepSeek V4.1 Flash 1017: text + image input, JSON mode, 1M context. */
export const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash-1017";
/** OpenRouter provider slug every request is pinned to (no fallback). */
export const OPENROUTER_DEFAULT_PROVIDER = "pearl-research";

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "openrouter") as LLMConfig["provider"];
  if (!["anthropic", "openai", "gemini", "openrouter"].includes(provider)) {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
  if (provider === "openrouter") {
    return {
      provider,
      model: process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
      apiKey: requireEnv("OPENROUTER_API_KEY"),
    };
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
