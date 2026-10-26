/**
 * Feedback forms: question types, the builder's validation, answer
 * checks, result tallies and CSV export. Pure functions, shared by the server and the browser.
 */

import * as z from "zod";

import { csvField } from "@/lib/events";

export const QUESTION_TYPES = [
  { value: "short", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "scale", label: "Linear scale" },
  { value: "rating", label: "Star rating" },
  { value: "section", label: "Section heading" },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

export function questionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Types with a list of options to pick from. */
export function hasOptions(type: QuestionType): boolean {
  return type === "choice" || type === "checkboxes" || type === "dropdown";
}

/** Everything except section headings takes an answer. */
export function isAnswerable(type: QuestionType): boolean {
  return type !== "section";
}

/** The highest value a scale or star rating question accepts. */
export function scaleTop(question: { type: QuestionType; scaleMax: number | null }): number {
  return question.type === "rating" ? 5 : (question.scaleMax ?? 5);
}

export interface FormQuestion {
  id?: string;
  type: QuestionType;
  prompt: string;
  help: string;
  required: boolean;
  options: string[];
  scaleMax: 5 | 10;
  minLabel: string;
  maxLabel: string;
}

export function blankQuestion(type: QuestionType = "choice"): FormQuestion {
  return {
    type,
    prompt: "",
    help: "",
    required: type !== "section",
    options: hasOptions(type) ? ["", ""] : [],
    scaleMax: 5,
    minLabel: "",
    maxLabel: "",
  };
}

const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES.map((t) => t.value) as [QuestionType, ...QuestionType[]]),
    prompt: z
      .string()
      .trim()
      .min(1, { error: "Write the question." })
      .max(300, { error: "Use 300 characters or fewer." }),
    help: z.string().trim().max(500, { error: "Use 500 characters or fewer." }),
    required: z.boolean(),
    options: z.array(z.string().trim().max(120, { error: "Keep options under 120 characters." })),
    scaleMax: z.union([z.literal(5), z.literal(10)]),
    minLabel: z.string().trim().max(40),
    maxLabel: z.string().trim().max(40),
  })
  .superRefine((q, ctx) => {
    if (!hasOptions(q.type)) return;
    const filled = q.options.filter(Boolean);
    if (filled.length < 2 || filled.length !== q.options.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Give at least two options, none empty.",
      });
    } else if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Each option must be different.",
      });
    } else if (filled.length > 20) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Use 20 options or fewer." });
    }
  });

export const formSchema = z
  .object({
    formId: z.union([z.literal(""), z.uuid()]),
    title: z
      .string()
      .trim()
      .min(3, { error: "Give the form a title." })
      .max(150, { error: "Use 150 characters or fewer." }),
    description: z.string().trim().max(2000, { error: "Use 2,000 characters or fewer." }),
    departmentId: z.uuid({ error: "Choose a department." }),
    batchIds: z.array(z.uuid()),
    aboutLecturerId: z.union([z.literal(""), z.uuid()]),
    /** ISO instant, or "" for no closing time. */
    closesAt: z.union([z.literal(""), z.iso.datetime()]),
    questions: z
      .array(questionSchema)
      .min(1, { error: "Add a question." })
      .max(50, { error: "Use 50 questions or fewer." }),
  })
  .refine((f) => f.questions.some((q) => isAnswerable(q.type)), {
    path: ["questions"],
    error: "Add at least one question to answer, not just headings.",
  });

export type FormInput = z.input<typeof formSchema>;

/** What a student gives for one question: text, a list of options, or a number. */
export type AnswerValue = string | string[] | number;

/** Required questions left unanswered, as question id → message (empty when complete). */
export function missingAnswers(
  questions: { id: string; type: QuestionType; required: boolean }[],
  answers: Record<string, AnswerValue | undefined>,
): Record<string, string> {
  const missing: Record<string, string> = {};
  for (const q of questions) {
    if (!q.required || !isAnswerable(q.type)) continue;
    const v = answers[q.id];
    const empty =
      v === undefined ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
    if (empty) missing[q.id] = "This question needs an answer.";
  }
  return missing;
}

export type FormStatus = "draft" | "open" | "closed";

/** A form past its closing time counts as closed even before anyone closes it. */
export function effectiveStatus(
  form: { status: FormStatus; closesAt: string | null },
  now: Date = new Date(),
): FormStatus {
  if (
    form.status === "open" &&
    form.closesAt &&
    new Date(form.closesAt).getTime() <= now.getTime()
  ) {
    return "closed";
  }
  return form.status;
}

export interface AnswerRow {
  questionId: string;
  responseId: string;
  text: string | null;
  options: string[] | null;
  number: number | null;
}

export type QuestionResult =
  | { kind: "counts"; total: number; counts: { label: string; count: number }[]; average?: number }
  | { kind: "text"; answers: string[] };

/**
 * Tallies one question's answers: counts per option (multiple choice, checkboxes, dropdown) or per
 * value with the average (scale, rating), or the list of written answers.
 */
export function summariseQuestion(
  question: { id: string; type: QuestionType; options: string[]; scaleMax: number | null },
  answers: AnswerRow[],
): QuestionResult {
  const mine = answers.filter((a) => a.questionId === question.id);
  if (question.type === "short" || question.type === "paragraph") {
    return { kind: "text", answers: mine.map((a) => a.text ?? "").filter(Boolean) };
  }
  if (question.type === "scale" || question.type === "rating") {
    const top = scaleTop(question);
    const values = mine.map((a) => a.number).filter((n): n is number => n !== null);
    return {
      kind: "counts",
      total: values.length,
      counts: Array.from({ length: top }, (_, i) => ({
        label: String(i + 1),
        count: values.filter((v) => v === i + 1).length,
      })),
      average: values.length
        ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
        : undefined,
    };
  }
  const picked = mine.flatMap((a) =>
    question.type === "checkboxes" ? (a.options ?? []) : a.text ? [a.text] : [],
  );
  return {
    kind: "counts",
    total: mine.length,
    counts: question.options.map((label) => ({
      label,
      count: picked.filter((p) => p === label).length,
    })),
  };
}

/** One row per response (in no particular order), one column per question. */
export function resultsCsv(
  questions: { id: string; type: QuestionType; prompt: string }[],
  answers: AnswerRow[],
): string {
  const asked = questions.filter((q) => isAnswerable(q.type));
  const responses = new Map<string, Map<string, string>>();
  for (const a of answers) {
    const row = responses.get(a.responseId) ?? new Map<string, string>();
    row.set(
      a.questionId,
      a.options?.join("; ") ?? (a.number !== null ? String(a.number) : (a.text ?? "")),
    );
    responses.set(a.responseId, row);
  }
  const lines = [asked.map((q) => csvField(q.prompt)).join(",")];
  for (const row of [...responses.keys()].sort().map((k) => responses.get(k)!)) {
    lines.push(asked.map((q) => csvField(row.get(q.id) ?? "")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
