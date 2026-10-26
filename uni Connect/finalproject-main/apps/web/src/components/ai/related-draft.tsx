"use client";

import { useEffect, useState } from "react";

import { RelatedQuestionList } from "@/components/ai/related-questions";
import { AIBadge } from "@/components/shared/badges";
import type { RelatedQuestion } from "@/server/ai/retrieve";

/**
 * While someone writes a new question, shows questions that look like it, so
 * they can read an existing answer instead of asking again. Waits until typing pauses.
 */
export function RelatedDraft({ title }: { title: string }) {
  const [questions, setQuestions] = useState<RelatedQuestion[]>([]);
  const text = title.trim();

  useEffect(() => {
    if (text.length < 15) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/ai/related", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = (await response.json()) as { questions: RelatedQuestion[] };
        setQuestions(body.questions);
      } catch {
        // Typing again cancels the request; a failed lookup just shows nothing.
      }
    }, 700);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [text]);

  if (text.length < 15 || questions.length === 0) return null;
  return (
    <aside
      aria-label="Similar questions"
      className="rounded-2xl border border-dashed border-ai/40 bg-ai/5 px-4 py-3"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <AIBadge label="Similar questions" />
        <span className="text-[13px] text-muted-foreground">
          Has this been asked already? They open in a new tab.
        </span>
      </div>
      <RelatedQuestionList questions={questions} newTab />
    </aside>
  );
}
