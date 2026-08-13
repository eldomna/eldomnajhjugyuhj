/**
 * Provider-agnostic AI contracts.
 *
 * Application code depends only on these types — never on a specific vendor.
 */

export type AITextPart = { type: "text"; text: string };
export type AIImagePart = { type: "image"; mimeType: string; base64: string };
export type AIFilePart = {
  type: "file";
  mimeType: string;
  base64: string;
  filename?: string;
};
export type AIPart = AITextPart | AIImagePart | AIFilePart;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  parts: AIPart[];
};

export type AIChatRequest = {
  messages: AIMessage[];
  /** Optional override; defaults to the configured AI_MODEL. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AIChatResult = { text: string };

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  chat(request: AIChatRequest): Promise<AIChatResult>;
}

/** Thrown when AI is not configured. Callers degrade gracefully. */
export class AINotConfiguredError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
    this.name = "AINotConfiguredError";
  }
}

/** Thrown for provider/transport failures, with a safe user-facing message. */
export class AIRequestError extends Error {
  status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
  }
}
