import { generateContent, GeminiApiError, readGeneratedText } from "@/lib/gemini";
import { pdfToGeminiPart, validateLecture } from "@/lib/pdf";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (isRateLimited(request)) {
      return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "The AI connection is not configured yet." }, { status: 503 });
    }

    const formData = await request.formData();
    const lectureResult = validateLecture(formData.get("lecture"));
    const question = formData.get("question");

    if ("error" in lectureResult) {
      return Response.json({ error: lectureResult.error }, { status: 400 });
    }

    if (typeof question !== "string" || !question.trim()) {
      return Response.json({ error: "Please enter a question." }, { status: 400 });
    }

    if (question.length > 2_000) {
      return Response.json({ error: "Please shorten your question." }, { status: 400 });
    }

    const pdfPart = await pdfToGeminiPart(lectureResult.file);
    const prompt = `
You are StudyMate, a careful university lecture assistant.

Rules:
- Answer ONLY from the attached PDF. Never add outside knowledge.
- If the answer is not supported by the PDF, say the equivalent of "I couldn't find that in this lecture" in the student's language.
- Use the same language as the student's question.
- Explain clearly and concisely for a beginner.
- Cite the relevant PDF page after each main point using [Page N].
- Do not invent page numbers or citations.
- Use plain text with line breaks. Do not use Markdown headings, bold markers, or code fences.

Student question:
${question.trim()}
`.trim();

    const result = await generateContent(apiKey, [pdfPart, { text: prompt }], {
      maxOutputTokens: 1_600,
      temperature: 0.2,
    });
    const answer = readGeneratedText(result);

    if (!answer) {
      return Response.json({ error: "No answer was returned. Please try again." }, { status: 502 });
    }

    return Response.json({ answer });
  } catch (error) {
    if (error instanceof GeminiApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "Something went wrong while reading the lecture." }, { status: 500 });
  }
}
