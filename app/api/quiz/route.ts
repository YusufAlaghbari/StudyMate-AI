import { generateContent, GeminiApiError, readGeneratedText } from "@/lib/gemini";
import { pdfToGeminiPart, validateLecture } from "@/lib/pdf";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  page: number;
};

function normalizeQuizQuestion(value: unknown): QuizQuestion | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const options = Array.isArray(item.options)
    ? item.options.filter((option): option is string => typeof option === "string")
    : [];
  const correctIndex = Number(item.correctIndex);
  const page = Number(String(item.page).replace(/[^0-9]/g, ""));

  if (
    typeof item.question !== "string" ||
    options.length !== 4 ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex > 3 ||
    typeof item.explanation !== "string" ||
    !Number.isInteger(page) ||
    page < 1
  ) {
    return null;
  }

  return {
    question: item.question,
    options,
    correctIndex,
    explanation: item.explanation,
    page,
  };
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function balanceCorrectAnswers(questions: QuizQuestion[]): QuizQuestion[] {
  const answerPositions = shuffle([
    0,
    1,
    2,
    3,
    ...Array.from({ length: Math.max(0, questions.length - 4) }, () =>
      Math.floor(Math.random() * 4),
    ),
  ]);

  return questions.map((question, questionIndex) => {
    const correctOption = question.options[question.correctIndex];
    const incorrectOptions = shuffle(
      question.options.filter((_, optionIndex) => optionIndex !== question.correctIndex),
    );
    const correctIndex = answerPositions[questionIndex];
    const options = [...incorrectOptions];
    options.splice(correctIndex, 0, correctOption);

    return { ...question, options, correctIndex };
  });
}

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

    if ("error" in lectureResult) {
      return Response.json({ error: lectureResult.error }, { status: 400 });
    }

    const pdfPart = await pdfToGeminiPart(lectureResult.file);
    const prompt = `
You are StudyMate, a careful university quiz creator.

Create exactly 5 multiple-choice questions using ONLY the attached PDF.

Rules:
- Use the main language of the PDF.
- Each question must have exactly 4 plausible options and exactly one correct answer.
- Mix important concepts, definitions, and applications from different pages.
- Keep questions clear and suitable for a beginner.
- Give a concise explanation for the correct answer.
- The page field must be the exact PDF page that supports the answer.
- Never use outside knowledge or invent a page number.
- Do not include Markdown symbols in any field.
- Return JSON only, with no code fences.

Required JSON structure:
{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","page":1}]}
`.trim();

    const result = await generateContent(apiKey, [pdfPart, { text: prompt }], {
      maxOutputTokens: 2_500,
      responseMimeType: "application/json",
      temperature: 0.35,
    });
    const rawText = readGeneratedText(result);

    if (!rawText) {
      return Response.json({ error: "No quiz was returned. Please try again." }, { status: 502 });
    }

    const parsed = JSON.parse(rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions = rawQuestions.map(normalizeQuizQuestion).filter(Boolean) as QuizQuestion[];

    if (questions.length !== 5) {
      return Response.json({ error: "The quiz format was incomplete. Please try again." }, { status: 502 });
    }

    return Response.json({ questions: balanceCorrectAnswers(questions) });
  } catch (error) {
    if (error instanceof GeminiApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "Something went wrong while creating the quiz." }, { status: 500 });
  }
}
