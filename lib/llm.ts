/**
 * Provider-agnostic LLM boundary. Server only.
 *
 * Supported providers: anthropic, openai, gemini, kagiro (OpenAI-compatible).
 * Configure with LLM_PROVIDER / LLM_MODEL / LLM_API_KEY in .env.local.
 */

import type { JudgeRawOutput, RubricCriterion } from "@/lib/domain/types";
import { JudgeOutputSchema } from "@/lib/encounter/schema";
import { getLLMConfig, type LLMConfig } from "@/lib/env";
import { JUDGE_SYSTEM, buildJudgePrompt } from "@/lib/prompts/judge_v1";
import { QUESTIONER_SYSTEM, buildQuestionPrompt } from "@/lib/prompts/questioner_v1";
import { assertDailyBudget, recordLlmUsage } from "@/lib/llmUsage";

export interface JudgeInput {
  playerAnswer: string;
  question?: string;
  evidenceQuote: string;
  weaknessType: string;
  rubricCriteria: RubricCriterion[];
  previousQuestions: string[];
  contextChunks?: Array<{ section: string | null; text: string }>;
  monsterLevel?: 1 | 2 | 3;
}

export interface QuestionInput {
  evidenceQuote: string;
  weaknessType: string;
  attackType: string;
  bossPersona: string;
  researchMapSummary: string;
  previousQuestions: string[];
  targetCriteria?: Array<{ id: string; label: string }>;
  contextChunks?: Array<{ section: string | null; text: string }>;
}

/**
 * Kagiro model routing, chosen by credit multiplier:
 *   2.5x deepseek-v4-flash
 *   3.5x deepseek-4-1-flash
 *   4.5x glm-5-3-flash
 * Expensive models (Claude 15x, glm5-3 7.5x, qwen-plus 7.3x) are opt-in via
 * LLM_MODEL_<SLUG>, not defaults.
 */
export const KAGIRO_BOSS_MODELS: Record<string, string> = {
  // Floor slugs
  "boss-floor-1": "deepseek-v4-flash",
  "boss-floor-2": "deepseek-v4-flash",
  "boss-floor-3": "deepseek-4-1-flash",
  "boss-floor-4": "deepseek-4-1-flash",
  "boss-floor-5": "deepseek-4-1-flash",
  "boss-floor-6": "glm-5-3-flash",

  // Fantasy names (Canon roster)
  veylith: "deepseek-v4-flash",
  draeven: "deepseek-v4-flash",
  kryvax: "deepseek-4-1-flash",
  morvane: "deepseek-4-1-flash",
  nyxara: "deepseek-4-1-flash",
  eldravos: "glm-5-3-flash",

  // Legacy role slugs
  gap_hunter: "deepseek-v4-flash",
  aligner: "deepseek-v4-flash",
  methodologist: "deepseek-4-1-flash",
  auditor: "deepseek-4-1-flash",
  ghost: "deepseek-4-1-flash",
  sir_actually: "glm-5-3-flash",
  minion: "deepseek-v4-flash",
};

export function resolveBossModel(bossSlug?: string | null): string | undefined {
  if (!bossSlug) return undefined;
  const slug = bossSlug.toLowerCase();
  const override = process.env[`LLM_MODEL_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`];
  if (override) return override;
  if (KAGIRO_BOSS_MODELS[slug]) return KAGIRO_BOSS_MODELS[slug];
  if (slug.startsWith("minion")) return KAGIRO_BOSS_MODELS.minion;
  return undefined;
}

export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  judgeAnswer(input: JudgeInput): Promise<JudgeRawOutput>;
  generateQuestion(input: QuestionInput): Promise<string>;
  completeJson(system: string, user: string, temperature?: number): Promise<unknown>;
  completeText(system: string, user: string, temperature?: number): Promise<string>;
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model tidak mengembalikan JSON valid.");
  }
}

class FetchLLMProvider implements LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.providerName = config.provider;
    this.modelName = config.model;
  }

  async judgeAnswer(input: JudgeInput): Promise<JudgeRawOutput> {
    const raw = await this.completeJson(
      JUDGE_SYSTEM,
      buildJudgePrompt(input),
      0.1,
    );
    return JudgeOutputSchema.parse(raw) as JudgeRawOutput;
  }

  async generateQuestion(input: QuestionInput): Promise<string> {
    return this.completeText(QUESTIONER_SYSTEM, buildQuestionPrompt(input), 0.2);
  }

  async completeJson(
    system: string,
    user: string,
    temperature = 0.1,
  ): Promise<unknown> {
    const first = await this.complete(system, user, temperature, true);
    try {
      return parseJsonText(first);
    } catch {
      const retry = await this.complete(
        `${system}\n\nOutput sebelumnya bukan JSON valid. Kembalikan JSON valid saja.`,
        user,
        0,
        true,
      );
      return parseJsonText(retry);
    }
  }

  async completeText(
    system: string,
    user: string,
    temperature = 0.2,
  ): Promise<string> {
    return (await this.complete(system, user, temperature, false)).trim();
  }

  private async complete(
    system: string,
    user: string,
    temperature: number,
    jsonMode: boolean,
  ): Promise<string> {
    const { provider, model, apiKey, baseUrl } = this.config;
    await assertDailyBudget();
    const signal = AbortSignal.timeout(90_000);
    const maxTokens = Math.max(
      256,
      Math.min(8192, Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 4096) || 4096),
    );

    if (provider === "anthropic") {
      const response = await fetch(
        `${baseUrl ?? "https://api.anthropic.com"}/v1/messages`,
        {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            system,
            messages: [{ role: "user", content: user }],
          }),
        },
      );
      const data = await readProviderResponse(response);
      const usage = data.usage as { input_tokens?: unknown; output_tokens?: unknown } | undefined;
      await recordLlmUsage({
        provider,
        model,
        promptTokens: usage?.input_tokens,
        completionTokens: usage?.output_tokens,
      });
      const content = Array.isArray(data.content)
        ? (data.content as Array<{ type: string; text?: string }>)
        : [];
      if (!Array.isArray(data.content)) {
        throw new Error(
          `Respons LLM (${provider}/${model}) tidak punya content: ${JSON.stringify(data).slice(0, 400)}`,
        );
      }
      return content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
    }

    if (provider === "openai" || provider === "kagiro") {
      const apiBase = baseUrl ?? (provider === "kagiro" ? "https://api.kagiro.net" : "https://api.openai.com");
      const response = await fetch(
        `${apiBase}/v1/chat/completions`,
        {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
      );
      const data = await readProviderResponse(response);
      const usage = data.usage as
        | { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown }
        | undefined;
      await recordLlmUsage({
        provider,
        model,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      });
      if (!Array.isArray(data.choices)) {
        throw new Error(
          `Respons LLM (${provider}/${model}) tidak punya choices: ${JSON.stringify(data).slice(0, 400)}`,
        );
      }
      const choices = data.choices as Array<{ message?: { content?: string } }>;
      return choices[0]?.message?.content ?? "";
    }

    const response = await fetch(
      `${baseUrl ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
    );
    const data = await readProviderResponse(response);
    const usage = data.usageMetadata as
      | { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown }
      | undefined;
    await recordLlmUsage({
      provider,
      model,
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
    });
    if (!Array.isArray(data.candidates)) {
      throw new Error(
        `Respons LLM (${provider}/${model}) tidak punya candidates: ${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    const candidates = data.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    return (candidates[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
  }
}

async function readProviderResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LLM ${response.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Respons LLM bukan JSON: ${text.slice(0, 300)}`);
  }
}

let _provider: LLMProvider | null = null;
const _bossProviders = new Map<string, LLMProvider>();

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;
  _provider = new FetchLLMProvider(getLLMConfig());
  return _provider;
}

/**
 * Judges follow the monster's routed model by default. Set LLM_MODEL_JUDGE to
 * cap every judge, or LLM_MODEL_JUDGE_<SLUG> for one monster.
 */
export function resolveJudgeModel(bossSlug?: string | null): string {
  const slug = bossSlug?.toLowerCase();
  const override = slug
    ? process.env[`LLM_MODEL_JUDGE_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`]
    : undefined;
  return (
    override ??
    process.env.LLM_MODEL_JUDGE ??
    resolveBossModel(bossSlug) ??
    "deepseek-v4-flash"
  );
}

export function resolveAnalysisModel(): string {
  return (
    process.env.LLM_MODEL_ANALYSIS ??
    process.env.LLM_MODEL_EXTRACT ??
    "deepseek-v4-flash"
  );
}

export function getLLMProviderForJudge(bossSlug?: string | null): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "kagiro") return base;

  const model = resolveJudgeModel(bossSlug);
  if (model === base.modelName) return base;

  const cached = _bossProviders.get(model);
  if (cached) return cached;

  try {
    const provider = new FetchLLMProvider({ ...getLLMConfig(), model });
    _bossProviders.set(model, provider);
    return provider;
  } catch {
    return base;
  }
}

/**
 * Recon and Cartographer are analysis, not boss dialogue. They use a cheap
 * model by default so LLM_MODEL=deepseek-v4-pro is not spent on them.
 */
export function getLLMProviderForAnalysis(): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "kagiro") return base;

  const model = resolveAnalysisModel();
  if (model === base.modelName) return base;

  const cached = _bossProviders.get(model);
  if (cached) return cached;

  try {
    const provider = new FetchLLMProvider({ ...getLLMConfig(), model });
    _bossProviders.set(model, provider);
    return provider;
  } catch {
    return base;
  }
}

/**
 * Research-map extraction is mechanical and latency-sensitive. On Kagiro it
 * uses a fast model by default; override with LLM_MODEL_EXTRACT.
 */
export function getLLMProviderForExtraction(): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "kagiro") return base;

  const model = resolveAnalysisModel();
  if (model === base.modelName) return base;

  const cached = _bossProviders.get(model);
  if (cached) return cached;

  try {
    const provider = new FetchLLMProvider({ ...getLLMConfig(), model });
    _bossProviders.set(model, provider);
    return provider;
  } catch {
    return base;
  }
}

export function getLLMProviderForBoss(bossSlug?: string | null): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "kagiro") return base;

  const model = resolveBossModel(bossSlug) ?? resolveAnalysisModel();
  if (model === base.modelName) return base;

  const cached = _bossProviders.get(model);
  if (cached) return cached;

  try {
    const provider = new FetchLLMProvider({ ...getLLMConfig(), model });
    _bossProviders.set(model, provider);
    return provider;
  } catch {
    return base;
  }
}

export function hasRealLLM(): boolean {
  try {
    return getLLMProvider().providerName !== "dummy";
  } catch {
    return false;
  }
}

export function setLLMProvider(provider: LLMProvider): void {
  _provider = provider;
  _bossProviders.clear();
}
