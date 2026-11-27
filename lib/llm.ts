/**
 * Provider-agnostic LLM boundary. Server only.
 *
 * Supported providers: openrouter (default, OpenAI-compatible), anthropic,
 * openai, gemini. OpenRouter needs only OPENROUTER_API_KEY in .env; model and
 * pinned upstream provider default to DeepSeek V4.1 Flash 1017 on Pearl Research.
 */

import type { JudgeRawOutput, RubricCriterion } from "@/lib/domain/types";
import { JudgeOutputSchema } from "@/lib/encounter/schema";
import {
  getLLMConfig,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_PROVIDER,
  type LLMConfig,
} from "@/lib/env";
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
  monsterLevel?: 1 | 2 | 3;
}

/** Default for latency-sensitive work (reading the manuscript, judging). */
export const FAST_MODEL = OPENROUTER_DEFAULT_MODEL;

/**
 * OpenRouter model per monster. Every slot defaults to the fast model; another
 * model is opt-in per monster via LLM_MODEL_<SLUG> (an OpenRouter model id that
 * the pinned provider also serves, or the request fails: fallbacks are off).
 */
export const BOSS_MODELS: Record<string, string> = {
  // Floor slugs
  "boss-floor-1": FAST_MODEL,
  "boss-floor-2": FAST_MODEL,
  "boss-floor-3": FAST_MODEL,
  "boss-floor-4": FAST_MODEL,
  "boss-floor-5": FAST_MODEL,
  "boss-floor-6": FAST_MODEL,

  // Fantasy names (Canon roster)
  veylith: FAST_MODEL,
  draeven: FAST_MODEL,
  kryvax: FAST_MODEL,
  morvane: FAST_MODEL,
  nyxara: FAST_MODEL,
  eldravos: FAST_MODEL,

  // Legacy role slugs
  gap_hunter: FAST_MODEL,
  aligner: FAST_MODEL,
  methodologist: FAST_MODEL,
  auditor: FAST_MODEL,
  ghost: FAST_MODEL,
  sir_actually: FAST_MODEL,
  minion: FAST_MODEL,
};

export function resolveBossModel(bossSlug?: string | null): string | undefined {
  if (!bossSlug) return undefined;
  const slug = bossSlug.toLowerCase();
  const override = process.env[`LLM_MODEL_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`];
  if (override) return override;
  if (BOSS_MODELS[slug]) return BOSS_MODELS[slug];
  if (slug.startsWith("minion")) return BOSS_MODELS.minion;
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

  /**
   * One logical completion: bounded concurrency plus retry with backoff on
   * rate limits and transient upstream errors. Providers throttle per key, so
   * an unbounded Promise.all would turn a fan-out into a wall of 429s.
   */
  private async complete(
    system: string,
    user: string,
    temperature: number,
    jsonMode: boolean,
  ): Promise<string> {
    await assertDailyBudget();
    return withLlmSlot(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.completeOnce(system, user, temperature, jsonMode);
        } catch (error) {
          const retryable =
            error instanceof LLMHttpError
              ? RETRYABLE_STATUS.has(error.status)
              : error instanceof TypeError; // network failure from fetch
          if (!retryable || attempt >= LLM_MAX_RETRIES) throw error;
          const hinted = error instanceof LLMHttpError ? error.retryAfterMs : null;
          const backoff = hinted ?? 1200 * 2 ** attempt + Math.random() * 400;
          await new Promise((resolve) => setTimeout(resolve, Math.min(backoff, 15_000)));
        }
      }
    });
  }

  private async completeOnce(
    system: string,
    user: string,
    temperature: number,
    jsonMode: boolean,
  ): Promise<string> {
    const { provider, model, apiKey, baseUrl } = this.config;
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

    if (provider === "openai" || provider === "openrouter") {
      const apiBase = baseUrl ?? (provider === "openrouter" ? "https://openrouter.ai/api" : "https://api.openai.com");
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
            ...(provider === "openrouter"
              ? {
                  // Pin the upstream host; fail rather than silently reroute.
                  provider: {
                    order: [process.env.OPENROUTER_PROVIDER || OPENROUTER_DEFAULT_PROVIDER],
                    allow_fallbacks: false,
                  },
                  // Reasoning tokens count against max_tokens; keep them small
                  // so the JSON answer is not truncated.
                  reasoning: {
                    effort: process.env.OPENROUTER_REASONING_EFFORT || "low",
                    exclude: true,
                  },
                }
              : {}),
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

export class LLMHttpError extends Error {
  constructor(
    readonly status: number,
    body: string,
    readonly retryAfterMs: number | null,
  ) {
    super(`LLM ${status}: ${body}`);
    this.name = "LLMHttpError";
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
const LLM_MAX_RETRIES = 3;
const LLM_MAX_CONCURRENCY = Math.max(
  1,
  Math.min(16, Number(process.env.LLM_MAX_CONCURRENCY ?? 4) || 4),
);

let llmActive = 0;
const llmWaiters: Array<() => void> = [];

/** Process-wide semaphore shared by every provider instance. */
async function withLlmSlot<T>(task: () => Promise<T>): Promise<T> {
  if (llmActive >= LLM_MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => llmWaiters.push(resolve));
  } else {
    llmActive++;
  }
  try {
    return await task();
  } finally {
    const next = llmWaiters.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else llmActive--;
  }
}

async function readProviderResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new LLMHttpError(
      response.status,
      text.slice(0, 500),
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
    );
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
  // One judge for every monster: the same answer must score the same in any
  // room.
  return override ?? process.env.LLM_MODEL_JUDGE ?? FAST_MODEL;
}

export function resolveAnalysisModel(): string {
  return process.env.LLM_MODEL_ANALYSIS ?? process.env.LLM_MODEL_EXTRACT ?? FAST_MODEL;
}

export function getLLMProviderForJudge(bossSlug?: string | null): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "openrouter") return base;

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
 * Recon and Cartographer are analysis, not boss dialogue. They use the fast
 * model by default so a pricier OPENROUTER_MODEL is not spent on them.
 */
export function getLLMProviderForAnalysis(): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "openrouter") return base;

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
 * Research-map extraction is mechanical and latency-sensitive. On OpenRouter
 * it uses the fast model by default; override with LLM_MODEL_EXTRACT.
 */
export function getLLMProviderForExtraction(): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "openrouter") return base;

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
  if (base.providerName !== "openrouter") return base;

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
