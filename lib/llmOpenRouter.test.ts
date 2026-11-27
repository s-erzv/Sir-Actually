import { describe, it, expect, vi, afterEach } from "vitest";
import { getLLMProvider } from "./llm";

describe("OpenRouter provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls DeepSeek V4.1 Flash 1017 pinned to Pearl Research without fallback", async () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: " ok " } }], usage: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = getLLMProvider();
    expect(provider.providerName).toBe("openrouter");
    expect(await provider.completeText("sys", "user")).toBe("ok");

    const chat = fetchMock.mock.calls.find(([url]) => String(url).includes("openrouter.ai"));
    expect(chat?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    const init = chat![1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("deepseek/deepseek-v4.1-flash-1017");
    expect(body.provider).toEqual({ order: ["pearl-research"], allow_fallbacks: false });
  });
});
