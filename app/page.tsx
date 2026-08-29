"use client";

import { FormEvent, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  Languages,
  LoaderCircle,
  Paperclip,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type UploadedLecture = {
  file: File;
  name: string;
  size: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  page: number;
};

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    text: "Upload a lecture, then ask me anything about it. I will stay grounded in your document and point you to the relevant page.",
  },
];

function isRtl(text: string) {
  return /[\u0600-\u06ff]/.test(text);
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const quizRef = useRef<HTMLElement>(null);
  const [lecture, setLecture] = useState<UploadedLecture | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const [uploadError, setUploadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const isBusy = isLoading || isQuizLoading;
  const quizScore = quizQuestions.reduce(
    (score, item, index) => score + (quizAnswers[index] === item.correctIndex ? 1 : 0),
    0,
  );

  function resetQuiz() {
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
  }

  function handleFile(file?: File) {
    setUploadError("");

    if (!file || file.type !== "application/pdf") {
      setUploadError("Please choose a valid PDF file.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Please choose a PDF smaller than 4 MB.");
      return;
    }

    setLecture({
      file,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    });
    setMessages(starterMessages);
    resetQuiz();
  }

  function removeLecture() {
    setLecture(null);
    setUploadError("");
    setMessages(starterMessages);
    resetQuiz();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isBusy) return;

    if (!lecture) {
      setMessages((current) => [
        ...current,
        { role: "user", text: trimmed },
        { role: "assistant", text: "Please upload a PDF lecture first." },
      ]);
      setQuestion("");
      return;
    }

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("lecture", lecture.file);
      formData.append("question", trimmed);

      const response = await fetch("/api/ask", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "StudyMate could not answer this question.");
      }

      setMessages((current) => [...current, { role: "assistant", text: result.answer }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateQuiz() {
    if (!lecture || isBusy) return;

    setIsQuizLoading(true);
    resetQuiz();

    try {
      const formData = new FormData();
      formData.append("lecture", lecture.file);

      const response = await fetch("/api/quiz", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "StudyMate could not create a quiz.");
      }

      setQuizQuestions(result.questions);
      window.setTimeout(
        () => quizRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "The quiz could not be created.",
        },
      ]);
    } finally {
      setIsQuizLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-[#18221f]">
      <header className="border-b border-[#18221f]/10 bg-[#f4f1e9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#173f35] text-[#f8f4e8] shadow-[0_8px_24px_rgba(23,63,53,0.18)]">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold tracking-[-0.02em]">StudyMate AI</p>
              <p className="text-xs text-[#50605b]">Grounded lecture assistant</p>
            </div>
          </div>
          <div className="rounded-full border border-[#173f35]/15 bg-[#e3ecdf] px-3 py-1.5 text-xs font-medium text-[#173f35]">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#3e7c63]" />
            Live project
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1440px] lg:grid-cols-[380px_1fr]">
        <aside className="border-b border-[#18221f]/10 p-5 lg:border-r lg:border-b-0 lg:p-8">
          <div className="sticky top-8 space-y-8">
            <section>
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#64716d]">
                <BookOpen className="size-4" aria-hidden="true" />
                Your lecture
              </div>

              {!lecture ? (
                <div
                  className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[#173f35]/30 bg-[#faf8f2] px-8 text-center transition hover:-translate-y-0.5 hover:border-[#173f35]/55 hover:shadow-[0_18px_45px_rgba(39,57,51,0.08)]"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleFile(event.dataTransfer.files[0]);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                  }}
                >
                  <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-[#e3ecdf] text-[#173f35] transition group-hover:scale-105">
                    <Paperclip className="size-6" aria-hidden="true" />
                  </div>
                  <p className="font-semibold">Drop your PDF here</p>
                  <p className="mt-2 max-w-52 text-sm leading-6 text-[#66736f]">
                    Or click to choose one lecture up to 4 MB.
                  </p>
                  <span className="mt-5 rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-[#f8f4e8]">
                    Choose PDF
                  </span>
                  <input
                    ref={inputRef}
                    className="sr-only"
                    type="file"
                    accept="application/pdf,.pdf"
                    aria-label="Upload a PDF lecture"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#173f35]/12 bg-[#faf8f2] p-5 shadow-[0_18px_45px_rgba(39,57,51,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f3d8c7] text-[#9a4c2f]">
                      <FileText className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{lecture.name}</p>
                      <p className="mt-1 text-xs text-[#66736f]">{lecture.size} · PDF</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeLecture}
                      className="grid size-9 place-items-center rounded-lg text-[#66736f] hover:bg-[#18221f]/5"
                      aria-label="Remove lecture"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#173f35]/10">
                    <div className="h-full w-full rounded-full bg-[#3e7c63]" />
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#e3ecdf] px-3 py-2.5 text-xs font-medium text-[#245849]">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Ready for questions
                  </div>
                  <button
                    type="button"
                    onClick={generateQuiz}
                    disabled={isBusy}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c66a42] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ad5633] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isQuizLoading ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                    {isQuizLoading ? "Creating your quiz…" : "Quiz Me"}
                  </button>
                </div>
              )}

              {uploadError && (
                <p className="mt-3 text-sm font-medium text-[#a1462d]" role="alert">
                  {uploadError}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64716d]">
                Built to be trustworthy
              </p>
              <div className="grid gap-2.5 text-sm text-[#4f5e59]">
                <TrustItem icon={<ShieldCheck />} label="Answers from your PDF only" />
                <TrustItem icon={<FileText />} label="Page-level citations" accent="text-[#c66a42]" />
                <TrustItem icon={<Languages />} label="Arabic & English support" accent="text-[#6b6fa7]" />
              </div>
            </section>
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col bg-[#fbfaf6]">
          <div className="border-b border-[#18221f]/8 px-5 py-6 sm:px-8 lg:px-10">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#3e7c63]">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Ask your lecture
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                  Turn dense notes into clear answers.
                </h1>
              </div>
              <div className="hidden rounded-full border border-[#18221f]/10 bg-white px-3 py-1.5 text-xs text-[#64716d] sm:block">
                Grounded mode
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex animate-rise items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#173f35] text-[#f8f4e8]">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </div>
                  )}
                  <div className={`max-w-[88%] ${message.role === "user" ? "text-right" : "text-left"}`}>
                    <p className="mb-1.5 text-xs font-semibold text-[#64716d]">
                      {message.role === "assistant" ? "StudyMate" : "You"}
                    </p>
                    <div
                      dir={isRtl(message.text) ? "rtl" : "ltr"}
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                        message.role === "assistant"
                          ? "border border-[#18221f]/10 bg-white text-[#33413d]"
                          : "bg-[#173f35] text-[#f8f4e8]"
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.role === "assistant" && index > 0 && (
                      <p className="mt-2 text-[11px] text-[#7b8582]">
                        Answers are limited to the uploaded lecture.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex animate-rise items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-[#173f35] text-[#f8f4e8]">
                    <GraduationCap className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-[#18221f]/10 bg-white px-4 py-3 text-sm text-[#50605b] shadow-sm">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Reading your lecture…
                  </div>
                </div>
              )}

              {quizQuestions.length > 0 && (
                <section
                  ref={quizRef}
                  className="animate-rise scroll-mt-6 rounded-[28px] border border-[#173f35]/12 bg-white p-5 shadow-[0_18px_55px_rgba(31,49,43,0.08)] sm:p-7"
                  aria-labelledby="quiz-title"
                >
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c66a42]">
                        <Sparkles className="size-4" aria-hidden="true" />
                        Lecture quiz
                      </div>
                      <h2 id="quiz-title" className="text-xl font-semibold tracking-[-0.025em]">
                        Test what you understood
                      </h2>
                      <p className="mt-1 text-sm text-[#66736f]">Choose one answer for each question.</p>
                    </div>
                    {quizSubmitted && (
                      <div className="rounded-2xl bg-[#e3ecdf] px-4 py-3 text-center text-[#173f35]">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em]">Your score</p>
                        <p className="mt-1 text-2xl font-bold">{quizScore}/{quizQuestions.length}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {quizQuestions.map((item, questionIndex) => (
                      <fieldset
                        key={`${item.question}-${questionIndex}`}
                        className="rounded-2xl border border-[#18221f]/10 bg-[#fbfaf6] p-4 sm:p-5"
                      >
                        <legend
                          dir={isRtl(item.question) ? "rtl" : "ltr"}
                          className="px-1 text-sm font-semibold leading-6 text-[#26332f]"
                        >
                          {questionIndex + 1}. {item.question}
                        </legend>
                        <div className="mt-3 grid gap-2">
                          {item.options.map((option, optionIndex) => {
                            const selected = quizAnswers[questionIndex] === optionIndex;
                            const correct = item.correctIndex === optionIndex;
                            const showCorrect = quizSubmitted && correct;
                            const showIncorrect = quizSubmitted && selected && !correct;

                            return (
                              <button
                                key={`${option}-${optionIndex}`}
                                type="button"
                                disabled={quizSubmitted}
                                onClick={() =>
                                  setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))
                                }
                                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm leading-5 transition ${
                                  showCorrect
                                    ? "border-[#3e7c63] bg-[#e3ecdf] text-[#173f35]"
                                    : showIncorrect
                                      ? "border-[#c66a42] bg-[#fae8de] text-[#813e27]"
                                      : selected
                                        ? "border-[#173f35] bg-[#edf1eb] text-[#173f35]"
                                        : "border-[#18221f]/10 bg-white text-[#4f5e59] hover:border-[#173f35]/35"
                                }`}
                              >
                                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current/25 text-xs font-semibold">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                                <span dir={isRtl(option) ? "rtl" : "ltr"}>{option}</span>
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && (
                          <div
                            dir={isRtl(item.explanation) ? "rtl" : "ltr"}
                            className="mt-3 rounded-xl bg-white px-3 py-3 text-sm leading-6 text-[#50605b]"
                          >
                            <span className="font-semibold text-[#26332f]">Explanation: </span>
                            {item.explanation}{" "}
                            <span className="font-semibold text-[#3e7c63]">[Page {item.page}]</span>
                          </div>
                        )}
                      </fieldset>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#7b8582]">
                      {Object.keys(quizAnswers).length} of {quizQuestions.length} answered
                    </p>
                    {quizSubmitted ? (
                      <button
                        type="button"
                        onClick={generateQuiz}
                        disabled={isBusy}
                        className="flex items-center gap-2 rounded-xl border border-[#173f35]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] hover:bg-[#edf1eb]"
                      >
                        <Sparkles className="size-4" aria-hidden="true" />
                        Create another quiz
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                        className="rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-[#f8f4e8] hover:bg-[#245849] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Check my answers
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="border-t border-[#18221f]/8 bg-[#fbfaf6]/95 px-5 py-5 sm:px-8 lg:px-10">
            <form className="mx-auto max-w-3xl" onSubmit={submitQuestion}>
              <div className="rounded-[22px] border border-[#18221f]/12 bg-white p-2 shadow-[0_16px_50px_rgba(31,49,43,0.08)] focus-within:border-[#3e7c63]/50 focus-within:ring-4 focus-within:ring-[#3e7c63]/8">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={lecture ? "Ask a question about your lecture…" : "Upload a PDF to begin…"}
                  className="min-h-20 w-full resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-[#8a9390]"
                  aria-label="Ask a question about your lecture"
                />
                <div className="flex items-center justify-between gap-4 px-1 pb-1">
                  <p className="pl-2 text-xs text-[#7b8582]">Enter to send · Shift + Enter for a new line</p>
                  <button
                    type="submit"
                    aria-label="Send question"
                    disabled={!question.trim() || isBusy}
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c66a42] text-white hover:bg-[#ad5633] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isLoading ? (
                      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] text-[#7b8582]">
                StudyMate may make mistakes. Verify important details on the cited page.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function TrustItem({
  icon,
  label,
  accent = "text-[#3e7c63]",
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#18221f]/8 bg-white/40 px-3 py-3">
      <span className={accent}>{icon}</span>
      {label}
    </div>
  );
}
