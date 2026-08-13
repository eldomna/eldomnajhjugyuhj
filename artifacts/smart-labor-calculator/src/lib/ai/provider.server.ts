/**
 * Server-only AI provider factory.
 *
 * Configuration is entirely environment-driven, so the provider can be
 * swapped without touching application code:
 *
 *   AI_PROVIDER = openai | anthropic | gemini | custom   (default: openai)
 *   AI_API_KEY  = provider API key (required to enable AI features)
 *   AI_MODEL    = model id (provider-specific default otherwise)
 *   AI_BASE_URL = override endpoint (required for `custom`, optional elsewhere)
 *
 * Never import this file from browser code — the `.server.ts` suffix keeps it
 * out of client bundles.
 */
import process from "node:process";

import {
  AINotConfiguredError,
  AIRequestError,
  type AIChatRequest,
  type AIChatResult,
  type AIMessage,
  type AIPart,
  type AIProvider,
} from "./types";

export type AIProviderName = "openai" | "anthropic" | "gemini" | "custom";

export type AIConfig = {
  provider: AIProviderName;
  apiKey: string | undefined;
  model: string;
  baseUrl: string;
};

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
  custom: "default",
};

const DEFAULT_BASE_URLS: Record<AIProviderName, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

function readProviderName(raw: string | undefined): AIProviderName {
  const value = (raw ?? "openai").trim().toLowerCase();
  if (value === "anthropic" || value === "gemini" || value === "custom" || value === "openai") {
    return value;
  }
  // Unknown names are treated as OpenAI-compatible endpoints.
  return "custom";
}

/** Reads AI configuration from the environment. Safe to call per request. */
export function getAIConfig(): AIConfig {
  const provider = readProviderName(process.env["AI_PROVIDER"]);
  const baseUrl = (process.env["AI_BASE_URL"] ?? DEFAULT_BASE_URLS[provider]).replace(/\/+$/, "");
  return {
    provider,
    apiKey: process.env["AI_API_KEY"]?.trim() || undefined,
    model: process.env["AI_MODEL"]?.trim() || DEFAULT_MODELS[provider],
    baseUrl,
  };
}

/** True when AI features can be used. */
export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!config.apiKey && !!config.baseUrl;
}

function dataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return res.statusText;
  }
}

function failFor(status: number, detail: string): AIRequestError {
  if (status === 401 || status === 403) {
    return new AIRequestError("رُفض مفتاح خدمة الذكاء الاصطناعي (تحقق من AI_API_KEY)", status);
  }
  if (status === 429) {
    return new AIRequestError("تم تجاوز حد الاستخدام لخدمة الذكاء الاصطناعي، حاول بعد قليل", status);
  }
  if (status === 402) {
    return new AIRequestError("انتهى رصيد خدمة الذكاء الاصطناعي", status);
  }
  return new AIRequestError(`تعذّر الاتصال بخدمة الذكاء الاصطناعي (${status}): ${detail}`, status);
}

/* ---------------------------------- OpenAI ---------------------------------- */
/** Also serves any OpenAI-compatible endpoint (Azure-style gateways, Ollama, vLLM…). */
function openAICompatibleProvider(config: AIConfig): AIProvider {
  const toContent = (parts: AIPart[]) =>
    parts.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image") {
        return { type: "image_url", image_url: { url: dataUrl(part.mimeType, part.base64) } };
      }
      return {
        type: "file",
        file: {
          filename: part.filename ?? "document",
          file_data: dataUrl(part.mimeType, part.base64),
        },
      };
    });

  return {
    name: config.provider,
    model: config.model,
    async chat(request: AIChatRequest): Promise<AIChatResult> {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model ?? config.model,
          messages: request.messages.map((message: AIMessage) => ({
            role: message.role,
            content: toContent(message.parts),
          })),
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.maxOutputTokens === undefined
            ? {}
            : { max_tokens: request.maxOutputTokens }),
        }),
      });
      if (!res.ok) throw failFor(res.status, await readError(res));
      const body = (await res.json()) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map((c) => c.text ?? "").join("")
            : "";
      return { text };
    },
  };
}

/* --------------------------------- Anthropic -------------------------------- */
function anthropicProvider(config: AIConfig): AIProvider {
  const toContent = (parts: AIPart[]) =>
    parts.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image") {
        return {
          type: "image",
          source: { type: "base64", media_type: part.mimeType, data: part.base64 },
        };
      }
      return {
        type: "document",
        source: { type: "base64", media_type: part.mimeType, data: part.base64 },
      };
    });

  return {
    name: "anthropic",
    model: config.model,
    async chat(request: AIChatRequest): Promise<AIChatResult> {
      const system = request.messages
        .filter((m) => m.role === "system")
        .flatMap((m) => m.parts)
        .filter((p): p is Extract<AIPart, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("\n\n");

      const res = await fetch(`${config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model ?? config.model,
          max_tokens: request.maxOutputTokens ?? 4096,
          ...(system ? { system } : {}),
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          messages: request.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: toContent(m.parts) })),
        }),
      });
      if (!res.ok) throw failFor(res.status, await readError(res));
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (body.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      return { text };
    },
  };
}

/* ----------------------------------- Gemini ---------------------------------- */
function geminiProvider(config: AIConfig): AIProvider {
  const toParts = (parts: AIPart[]) =>
    parts.map((part) =>
      part.type === "text"
        ? { text: part.text }
        : { inline_data: { mime_type: part.mimeType, data: part.base64 } },
    );

  return {
    name: "gemini",
    model: config.model,
    async chat(request: AIChatRequest): Promise<AIChatResult> {
      const model = request.model ?? config.model;
      const systemParts = request.messages
        .filter((m) => m.role === "system")
        .flatMap((m) => toParts(m.parts));

      const res = await fetch(
        `${config.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": config.apiKey ?? "",
          },
          body: JSON.stringify({
            ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
            contents: request.messages
              .filter((m) => m.role !== "system")
              .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: toParts(m.parts),
              })),
            generationConfig: {
              ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
              ...(request.maxOutputTokens === undefined
                ? {}
                : { maxOutputTokens: request.maxOutputTokens }),
            },
          }),
        },
      );
      if (!res.ok) throw failFor(res.status, await readError(res));
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("");
      return { text };
    },
  };
}

/**
 * Returns the configured provider.
 * @throws AINotConfiguredError when no API key / base URL is configured.
 */
export function getAIProvider(): AIProvider {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new AINotConfiguredError(
      "خدمة الذكاء الاصطناعي غير مهيأة: أضف AI_API_KEY (و AI_PROVIDER) إلى إعدادات البيئة",
    );
  }
  if (!config.baseUrl) {
    throw new AINotConfiguredError(
      "خدمة الذكاء الاصطناعي غير مهيأة: أضف AI_BASE_URL إلى إعدادات البيئة",
    );
  }
  switch (config.provider) {
    case "anthropic":
      return anthropicProvider(config);
    case "gemini":
      return geminiProvider(config);
    default:
      return openAICompatibleProvider(config);
  }
}
