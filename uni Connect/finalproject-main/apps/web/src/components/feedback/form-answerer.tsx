"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { missingAnswers, scaleTop, type AnswerValue, type QuestionType } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { submitForm } from "@/server/actions/forms";

export interface AnswerableQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  help: string;
  required: boolean;
  options: string[];
  scaleMax: number | null;
  minLabel: string | null;
  maxLabel: string | null;
}

/**
 * A student answering a feedback form (Phase E). In `preview` mode (the builder) nothing is sent.
 * Answers go to `submit_form`, which stores them without the student's id.
 */
export function FormAnswerer({
  formId,
  questions,
  preview,
}: {
  formId?: string;
  questions: AnswerableQuestion[];
  preview?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set(id: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => ({ ...e, [id]: "" }));
  }

  function submit() {
    const missing = missingAnswers(questions, answers);
    setErrors(missing);
    const first = questions.find((q) => missing[q.id]);
    if (first) {
      document
        .getElementById(`q-${first.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Answer the required questions first.");
      return;
    }
    if (preview || !formId) {
      toast.success("This is a preview: nothing was sent.");
      return;
    }
    startTransition(async () => {
      const cleaned = Object.fromEntries(
        Object.entries(answers).filter(([, v]) => !(typeof v === "string" && v.trim() === "")),
      );
      const result = await submitForm(formId, cleaned);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Sent.");
      router.refresh();
    });
  }

  let number = 0;
  return (
    <div className="space-y-4">
      {questions.map((q) => {
        if (q.type === "section") {
          return (
            <div key={q.id} className="pt-4">
              <h2 className="text-lg font-extrabold">{q.prompt}</h2>
              {q.help && <p className="mt-1 text-sm text-muted-foreground">{q.help}</p>}
            </div>
          );
        }
        number++;
        const error = errors[q.id];
        const labelId = `q-${q.id}-label`;
        return (
          <fieldset
            key={q.id}
            id={`q-${q.id}`}
            aria-labelledby={labelId}
            aria-invalid={error ? true : undefined}
            className={cn(
              "rounded-[22px] border bg-card p-5 shadow-soft",
              error && "border-destructive/60",
            )}
          >
            <legend className="sr-only">{q.prompt}</legend>
            <p id={labelId} className="font-bold">
              <span className="text-muted-foreground">{number}. </span>
              {q.prompt}
              {q.required && (
                <span className="text-destructive" aria-label="required">
                  {" "}
                  *
                </span>
              )}
            </p>
            {q.help && <p className="mt-1 text-sm text-muted-foreground">{q.help}</p>}
            <div className="mt-3">
              <QuestionInput question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
            </div>
            {error && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
                {error}
              </p>
            )}
          </fieldset>
        );
      })}
      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : preview ? "Submit (preview)" : "Send anonymously"}
        </Button>
      </div>
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: AnswerableQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const name = `answer-${q.id}`;
  switch (q.type) {
    case "short":
      return (
        <TextInput
          aria-label={q.prompt}
          value={(value as string) ?? ""}
          maxLength={300}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "paragraph":
      return (
        <TextArea
          aria-label={q.prompt}
          rows={4}
          maxLength={2000}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "dropdown":
      return (
        <SelectInput
          aria-label={q.prompt}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </SelectInput>
      );
    case "choice":
    case "checkboxes": {
      const multi = q.type === "checkboxes";
      const picked = multi ? ((value as string[]) ?? []) : [value as string];
      return (
        <div className="space-y-1">
          {q.options.map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-accent/50"
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={name}
                className="size-4.5 accent-primary"
                checked={picked.includes(o)}
                onChange={(e) =>
                  onChange(
                    multi ? (e.target.checked ? [...picked, o] : picked.filter((p) => p !== o)) : o,
                  )
                }
              />
              <span className="text-[15px]">{o}</span>
            </label>
          ))}
        </div>
      );
    }
    case "scale": {
      const top = scaleTop(q);
      return (
        <div>
          <div role="radiogroup" aria-label={q.prompt} className="flex flex-wrap gap-2">
            {Array.from({ length: top }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={String(n)}
                onClick={() => onChange(n)}
                className={cn(
                  "grid size-11 place-items-center rounded-full border text-sm font-bold transition-colors",
                  value === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-primary/60",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {(q.minLabel || q.maxLabel) && (
            <div className="mt-2 flex justify-between gap-4 text-[13px] text-muted-foreground">
              <span>1 = {q.minLabel || "lowest"}</span>
              <span>
                {top} = {q.maxLabel || "highest"}
              </span>
            </div>
          )}
        </div>
      );
    }
    case "rating":
      return (
        <div role="radiogroup" aria-label={q.prompt} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => onChange(n)}
              className="grid size-11 place-items-center rounded-full hover:bg-accent/60"
            >
              <Star
                className={cn(
                  "size-7",
                  typeof value === "number" && n <= value
                    ? "fill-warning text-warning"
                    : "text-muted-foreground",
                )}
                aria-hidden
              />
            </button>
          ))}
        </div>
      );
    default:
      return null;
  }
}
