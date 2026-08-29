const GEMINI_MODEL = "gemini-3.7-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

export async function generateContent(
  apiKey: string,
  parts: GeminiPart[],
  generationConfig: GenerationConfig,
) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig,
  });

  const send = () =>
    fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
      cache: "no-store",
    });

  let response = await send();

  if (response.status === 429 || response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    response = await send();
  }

  const result = await response.json();

  if (!response.ok) {
    const message =
      response.status === 429 || response.status === 503
        ? "The AI model is busy right now. Please try again in a moment."
        : "The AI service could not complete this request.";
    throw new GeminiApiError(response.status, message);
  }

  return result;
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
