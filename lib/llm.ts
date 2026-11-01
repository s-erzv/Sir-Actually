/**
 * Provider-agnostic LLM boundary. Server only.
 *
 * Supported providers: anthropic, openai, gemini, kagiro (OpenAI-compatible).
 * Configure with LLM_PROVIDER / LLM_MODEL / LLM_API_KEY in .env.local.
 */

import type { JudgeRawOutput, RubricCriterion } from "@/lib/domain/types";
import { getLLMConfig, type LLMConfig } from "@/lib/env";
import { JUDGE_SYSTEM, buildJudgePrompt } from "@/lib/prompts/judge_v1";
import { QUESTIONER_SYSTEM, buildQuestionPrompt } from "@/lib/prompts/questioner_v1";

export interface JudgeInput {
  playerAnswer: string;
  evidenceQuote: string;
  weaknessType: string;
  rubricCriteria: RubricCriterion[];
  previousQuestions: string[];
}

export interface QuestionInput {
  evidenceQuote: string;
  weaknessType: string;
  attackType: string;
  bossPersona: string;
  researchMapSummary: string;
  previousQuestions: string[];
}

/**
 * Kagiro model routing. Bosses get progressively stronger models; the final
 * sovereign (Morvane / Eldravos) uses Claude Sonnet.
 *
 * These IDs must match https://api.kagiro.net/v1/models exactly.
 */
export const KAGIRO_BOSS_MODELS: Record<string, string> = {
  // Floor slugs
  "boss-floor-1": "deepseek-v4.1-flash-1017",
  "boss-floor-2": "glm-5-3-flash",
  "boss-floor-3": "kimi-k3",
  "boss-floor-4": "claude-sonnet-4-6",
  "boss-floor-5": "gemini-3-8-flash",
  "boss-floor-6": "claude-sonnet-4-6",

  // Fantasy names (Canon roster)
  veylith: "deepseek-v4.1-flash-1017",
  draeven: "glm-5-3-flash",
  kryvax: "kimi-k3",
  morvane: "claude-sonnet-4-6",
  nyxara: "gemini-3-8-flash",
  eldravos: "claude-sonnet-4-6",

  // Legacy role slugs
  gap_hunter: "deepseek-v4.1-flash-1017",
  aligner: "glm-5-3-flash",
  methodologist: "kimi-k3",
  auditor: "claude-sonnet-4-6",
  ghost: "gemini-3-8-flash",
  sir_actually: "claude-sonnet-4-6",
  minion: "deepseek-v4-flash",
};

export function resolveBossModel(bossSlug?: string | null): string | undefined {
  if (!bossSlug) return undefined;
  const slug = bossSlug.toLowerCase();
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

export class DummyLLMProvider implements LLMProvider {
  readonly providerName = "dummy";
  readonly modelName = "dummy";

  async judgeAnswer(input: JudgeInput): Promise<JudgeRawOutput> {
    const words = input.playerAnswer.trim().split(/\s+/).filter(Boolean);
    const criteria = input.rubricCriteria;

    if (words.length < 10) {
      return {
        criteria: criteria.map((c) => ({ id: c.id, level: 0 as const, quote: "" })),
        missing: "Jawaban terlalu singkat untuk dinilai.",
      };
    }

    const shortQuote = words.slice(0, 3).join(" ");
    const numLevel1 = words.length < 30 ? 1 : words.length < 60 ? 2 : criteria.length;
    return {
      criteria: criteria.map((c, i) => ({
        id: c.id,
        level: (i < numLevel1 ? 1 : 0) as 0 | 1 | 2,
        quote: i < numLevel1 ? shortQuote : "",
      })),
      missing: "Jawaban masih perlu didukung bukti atau angka dari naskah.",
    };
  }

  async generateQuestion(input: QuestionInput): Promise<string> {
    return `[Dummy] Pertanyaan untuk ${input.weaknessType} (${input.attackType}): Jelaskan lebih lanjut mengenai: "${input.evidenceQuote}".`;
  }

  async completeJson(): Promise<unknown> {
    throw new Error("LLM belum dikonfigurasi. Isi LLM_API_KEY dan LLM_MODEL di .env.local.");
  }

  async completeText(): Promise<string> {
    throw new Error("LLM belum dikonfigurasi. Isi LLM_API_KEY dan LLM_MODEL di .env.local.");
  }
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
    return (await this.completeJson(
      JUDGE_SYSTEM,
      buildJudgePrompt(input),
      0.1,
    )) as JudgeRawOutput;
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
    const signal = AbortSignal.timeout(90_000);

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
            max_tokens: 8192,
            temperature,
            system,
            messages: [{ role: "user", content: user }],
          }),
        },
      );
      const data = await readProviderResponse(response);
      const content = data.content as Array<{ type: string; text?: string }>;
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
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
    );
    const data = await readProviderResponse(response);
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
  try {
    _provider = new FetchLLMProvider(getLLMConfig());
  } catch {
    _provider = new DummyLLMProvider();
  }
  return _provider;
}

export function getLLMProviderForBoss(bossSlug?: string | null): LLMProvider {
  const base = getLLMProvider();
  if (base.providerName !== "kagiro") return base;

  const model = resolveBossModel(bossSlug);
  if (!model || model === base.modelName) return base;

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
  return getLLMProvider().providerName !== "dummy";
}

export function setLLMProvider(provider: LLMProvider): void {
  _provider = provider;
  _bossProviders.clear();
}
