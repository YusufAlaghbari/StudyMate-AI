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

type QuizValidation = {
  question: QuizQuestion | null;
  issues: string[];
};

const QUIZ_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          page: { type: "integer", minimum: 1 },
        },
        required: ["question", "options", "correctIndex", "explanation", "page"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const QUIZ_GENERATION_ATTEMPTS = 2;

function validateQuizQuestion(value: unknown): QuizValidation {
  if (!value || typeof value !== "object") {
    return { question: null, issues: ["not_an_object"] };
  }

  const item = value as Record<string, unknown>;
  const options = Array.isArray(item.options)
    ? item.options.filter((option): option is string => typeof option === "string")
    : [];
  const correctIndex = Number(item.correctIndex);
  const page = Number(String(item.page).replace(/[^0-9]/g, ""));
  const issues: string[] = [];

  if (typeof item.question !== "string") issues.push("invalid_question");
  if (!Array.isArray(item.options)) issues.push("options_not_array");
  else if (item.options.length !== 4) issues.push("invalid_option_count");
  if (Array.isArray(item.options) && options.length !== item.options.length) {
    issues.push("non_string_option");
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    issues.push("invalid_correct_index");
  }
  if (typeof item.explanation !== "string") issues.push("invalid_explanation");
  if (!Number.isInteger(page) || page < 1) issues.push("invalid_page");

  if (issues.length > 0) return { question: null, issues };

  return {
    question: {
      question: item.question as string,
      options,
      correctIndex,
      explanation: item.explanation as string,
      page,
    },
    issues,
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
`.trim();

    for (let generationAttempt = 1; generationAttempt <= QUIZ_GENERATION_ATTEMPTS; generationAttempt += 1) {
      const attemptPrompt =
        generationAttempt === 1
          ? prompt
          : `${prompt}\n\nThe previous response was incomplete. Return all five questions with every required field.`;
      const result = await generateContent(apiKey, [pdfPart, { text: attemptPrompt }], {
        maxOutputTokens: 2_500,
        responseMimeType: "application/json",
        responseJsonSchema: QUIZ_RESPONSE_SCHEMA,
        temperature: 0.35,
      });
      const rawText = readGeneratedText(result);

      if (!rawText) {
        console.warn(
          `[StudyMate AI] Quiz generation attempt ${generationAttempt} returned no text.`,
        );
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
      } catch {
        console.warn(
          `[StudyMate AI] Quiz generation attempt ${generationAttempt} returned invalid JSON.`,
          { responseLength: rawText.length },
        );
        continue;
      }

      const parsedObject =
        parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
      const rawQuestions = Array.isArray(parsedObject?.questions) ? parsedObject.questions : [];
      const validationResults = rawQuestions.map(validateQuizQuestion);
      const questions = validationResults
        .map(({ question }) => question)
        .filter((question): question is QuizQuestion => question !== null);

      if (rawQuestions.length === 5 && questions.length === 5) {
        return Response.json({ questions: balanceCorrectAnswers(questions) });
      }

      console.warn(
        `[StudyMate AI] Quiz generation attempt ${generationAttempt} returned an incomplete quiz.`,
        {
          rawQuestionCount: rawQuestions.length,
          validQuestionCount: questions.length,
          invalidQuestions: validationResults
            .map(({ issues }, index) => ({ index, issues }))
            .filter(({ issues }) => issues.length > 0),
        },
      );
    }

    return Response.json(
      { error: "The quiz format was incomplete. Please try again." },
      { status: 502 },
    );
  } catch (error) {
    if (error instanceof GeminiApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "Something went wrong while creating the quiz." }, { status: 500 });
  }
}
