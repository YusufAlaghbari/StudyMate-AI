const DEFAULT_GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];
const GEMINI_MODELS = (process.env.GEMINI_MODELS ?? DEFAULT_GEMINI_MODELS.join(","))
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const MAX_ATTEMPTS = 4;
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: "application/pdf"; data: string } };

type GenerationConfig = {
  maxOutputTokens: number;
  responseMimeType?: "application/json";
  temperature?: number;
};

export class GeminiApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(attempt: number, response?: Response) {
  const retryAfter = Number(response?.headers.get("retry-after"));

  if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 10) {
    return retryAfter * 1_000;
  }

  const exponentialDelay = Math.min(8_000, 1_000 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 300);
  return exponentialDelay + jitter;
}

function publicErrorMessage(status: number) {
  if (status === 429) {
    return "StudyMate has reached its temporary AI usage limit. Please wait one minute and try again.";
  }

  if (TRANSIENT_STATUSES.has(status)) {
    return "The AI service is temporarily unavailable. Please try again in a moment.";
  }

  if (status === 400 || status === 403) {
    return "The AI connection needs administrator attention.";
  }

  return "The AI service could not complete this request.";
}

export async function generateContent(
  apiKey: string,
  parts: GeminiPart[],
  generationConfig: GenerationConfig,
) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig,
  });

  let lastStatus = 503;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const model = GEMINI_MODELS[attempt % GEMINI_MODELS.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        cache: "no-store",
      });
    } catch {
      lastStatus = 503;

      if (attempt === MAX_ATTEMPTS - 1) {
        throw new GeminiApiError(lastStatus, publicErrorMessage(lastStatus));
      }

      await sleep(retryDelay(attempt));
      continue;
    }

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      return result;
    }

    lastStatus = response.status;
    console.warn(
      `[StudyMate AI] Gemini model ${model} returned ${response.status} on attempt ${attempt + 1}.`,
    );

    const canRetry = TRANSIENT_STATUSES.has(response.status);
    if (!canRetry || attempt === MAX_ATTEMPTS - 1) {
      throw new GeminiApiError(response.status, publicErrorMessage(response.status));
    }

    await sleep(retryDelay(attempt, response));
  }

  throw new GeminiApiError(lastStatus, publicErrorMessage(lastStatus));
}

export function readGeneratedText(result: unknown) {
  const payload = result as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}
