import { Client } from "@gradio/client";

const AI_CONNECT_TIMEOUT_MS = 6000;
const AI_PREDICT_TIMEOUT_MS = 7000;
const TOXIC_FLAG_THRESHOLD = 0.6;

type ModerationMap = Record<string, boolean>;
type ModerationPayload =
  | string
  | number
  | boolean
  | null
  | undefined
  | ModerationMap
  | ModerationPayload[];

type PredictionResult = {
  data?: unknown;
};

export type CommentAiFields = {
  aiComment: string;
  aiScore: number;
  flagged: boolean;
  sentimentLabel: "NEGATIVE" | "NEUTRAL" | "POSITIVE";
  sentimentScore: number;
};

type ModerationResult = Pick<CommentAiFields, "aiComment" | "aiScore" | "flagged">;

type SentimentResult = {
  label: CommentAiFields["sentimentLabel"];
  raw: string;
  score: number;
};

type ToxicConfidence = {
  confidence?: number | null;
  label?: string | number | null;
};

type ToxicPrediction = {
  confidences?: ToxicConfidence[] | null;
  label?: string | number | null;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function connectWithTimeout(app: string) {
  return withTimeout(Client.connect(app), AI_CONNECT_TIMEOUT_MS, `AI connection to ${app}`);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function normalizeModerationValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true";
}

function stringifyModerationComment(payload: ModerationPayload): string {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = stringifyModerationComment(item);
      if (text) {
        return text;
      }
    }
    return "";
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${normalizeModerationValue(value) ? "Yes" : "No"}`)
      .join("\n");
  }

  return String(payload ?? "").trim();
}

function parseModerationResult(payload: ModerationPayload): ModerationMap {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, normalizeModerationValue(value)])
    );
  }

  const text = stringifyModerationComment(payload);
  const lines = text.split("\n");
  const result: ModerationMap = {};

  for (const line of lines) {
    const [key, value] = line.split(":").map((segment) => segment.trim());
    if (key) {
      result[key] = normalizeModerationValue(value);
    }
  }

  return result;
}

function computeScore(result: ModerationMap): number {
  return Object.values(result).filter(Boolean).length;
}

function normalizeToxicConfidence(value: unknown): number | null {
  if (typeof value === "number") {
    return value > 1 ? value / 100 : value;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed > 1 ? parsed / 100 : parsed;
}

function parseToxicPrediction(rawData: unknown): ModerationResult {
  const payload =
    rawData && typeof rawData === "object" && !Array.isArray(rawData)
      ? (rawData as ToxicPrediction)
      : null;

  if (!payload) {
    throw new Error("moderateText failed");
  }

  const verdictLabel = String(payload.label ?? "").trim();
  const confidences = Array.isArray(payload.confidences) ? payload.confidences : [];

  const normalized = confidences
    .map((entry) => ({
      confidence: normalizeToxicConfidence(entry.confidence),
      label: String(entry.label ?? "").trim(),
    }))
    .filter(
      (entry): entry is { confidence: number; label: string } =>
        entry.confidence !== null && entry.label !== ""
    );

  const topEntry = normalized.reduce<{ confidence: number; label: string } | null>(
    (best, current) => {
      if (!best || current.confidence > best.confidence) {
        return current;
      }
      return best;
    },
    null
  );

  const verdict = verdictLabel || topEntry?.label || "unknown";
  const aiScore = Number((topEntry?.confidence ?? 0).toFixed(4));
  const details =
    normalized.length > 0
      ? normalized
          .map((entry) => `${entry.label}: ${(entry.confidence * 100).toFixed(0)}%`)
          .join("\n")
      : "";

  return {
    aiComment: details ? `${verdict}\n${details}` : verdict,
    aiScore,
    flagged: verdict.toLowerCase().includes("toxic") && aiScore >= TOXIC_FLAG_THRESHOLD,
  };
}

export async function moderateText({ text }: { text: string }): Promise<ModerationResult> {
  const cleanText = String(text ?? "").trim();

  if (!cleanText) {
    throw new Error("Text is required for moderation");
  }

  const moderator = getRequiredEnv("AI_MODERATOR");
  const api = getRequiredEnv("AI_MODERATOR_API");
  const client = await connectWithTimeout(moderator);
  const result = (await withTimeout(
    client.predict(api, {
      text: cleanText,
    }),
    AI_PREDICT_TIMEOUT_MS,
    `AI request ${api}`
  )) as PredictionResult;

  const rawData = result.data;
  return parseToxicPrediction(Array.isArray(rawData) ? rawData[0] : rawData);
}

export async function translateText({
  source = "Auto Detect",
  target = "English",
  text,
}: {
  source?: string;
  target?: string;
  text: string;
}): Promise<{ translatedText: string }> {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) {
    throw new Error("text is required");
  }

  const translator = getRequiredEnv("AI_TRANSLATOR");
  const api = getRequiredEnv("AI_TRANSLATOR_API");
  const client = await connectWithTimeout(translator);

  const result = (await withTimeout(
    client.predict(api, {
      input_text: cleanText,
      source,
      target,
    }),
    AI_PREDICT_TIMEOUT_MS,
    `AI request ${api}`
  )) as PredictionResult;

  const rawData = result.data;
  const translated = Array.isArray(rawData) ? rawData[0] : null;

  if (typeof translated !== "string" || !translated.trim()) {
    throw new Error("Translation failed");
  }

  return {
    translatedText: translated,
  };
}

export async function analyzeSentiment({
  text,
}: {
  text: string;
}): Promise<SentimentResult> {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) {
    throw new Error("text is required");
  }

  const sentiment = getRequiredEnv("AI_SENTIMENT");
  const api = getRequiredEnv("AI_SENTIMENT_API");
  const client = await connectWithTimeout(sentiment);

  const result = (await withTimeout(
    client.predict(api, {
      review_text: cleanText,
    }),
    AI_PREDICT_TIMEOUT_MS,
    `AI request ${api}`
  )) as PredictionResult;

  const rawData = result.data;
  const rawValue = Array.isArray(rawData) ? rawData[0] : rawData;
  const raw = String(rawValue ?? "").trim();
  const upper = raw.toUpperCase();

  if (upper.includes("POSITIVE")) {
    return {
      label: "POSITIVE",
      raw,
      score: 1,
    };
  }

  if (upper.includes("NEGATIVE")) {
    return {
      label: "NEGATIVE",
      raw,
      score: -1,
    };
  }

  return {
    label: "NEUTRAL",
    raw,
    score: 0,
  };
}
