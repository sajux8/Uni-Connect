"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AIBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import type { FormSummary } from "@/lib/ai/prompts";
import { formatCampus } from "@/lib/campus-time";
import { summarizeForm, type StoredFormSummary } from "@/server/actions/ai";

const SECTIONS: { key: keyof FormSummary; title: string }[] = [
  { key: "themes", title: "Main themes" },
  { key: "positives", title: "What's working" },
  { key: "concerns", title: "Concerns" },
  { key: "suggestions", title: "Suggestions" },
];

/**
 * AI summary of a feedback form's written answers (Phase E + M8), for the people who can see the
 * results. The answers are anonymous; the summary never names anyone.
 */
export function FormSummaryCard({
  formId,
  writtenAnswers,
  minimum,
  initial,
}: {
  formId: string;
  /** Written (text) answers right now. */
  writtenAnswers: number;
  minimum: number;
  initial: StoredFormSummary | null;
}) {
  const [stored, setStored] = useState(initial);
  const [pending, startTransition] = useTransition();
  const newAnswers = stored ? writtenAnswers - stored.answerCount : 0;
  const enough = writtenAnswers >= minimum;

  function generate() {
    startTransition(async () => {
      const result = await summarizeForm(formId);
      if (!result.ok) return void toast.error(result.error);
      setStored(result.data);
    });
  }

  return (
    <section
      aria-label="AI summary of the written answers"
      className="rounded-[22px] border border-dashed border-ai/40 bg-ai/5 p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AIBadge label="AI summary" />
        {enough && (!stored || newAnswers > 0) && (
          <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
            {stored ? (
              <RefreshCw data-icon="inline-start" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {pending ? "Summarising…" : stored ? "Update summary" : "Summarise written answers"}
          </Button>
        )}
      </div>

      {!stored ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {enough
            ? `Get the main themes, what's working, concerns and suggestions from the ${writtenAnswers} written answers.`
            : `A summary is available once there are at least ${minimum} written answers, so no single student stands out.`}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SECTIONS.filter((s) => stored.summary[s.key].length > 0).map((section) => (
              <div key={section.key}>
                <h3 className="text-[13px] font-extrabold text-ai">{section.title}</h3>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[15px]">
                  {stored.summary[section.key].map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-ai/20 pt-3 text-[13px] text-muted-foreground">
            AI-generated · based on {stored.answerCount} written answers ·{" "}
            {formatCampus(stored.generatedAt, "day")}. Read the answers below before acting on it.
            {newAnswers > 0 &&
              ` ${newAnswers} new ${newAnswers === 1 ? "answer" : "answers"} since this summary.`}
          </p>
        </>
      )}
    </section>
  );
}
