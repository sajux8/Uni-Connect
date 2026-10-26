import { CircleCheck, MessageSquare } from "lucide-react";
import Link from "next/link";

import type { RelatedQuestion } from "@/server/ai/retrieve";

/** A short list of similar questions. Server-safe. */
export function RelatedQuestionList({
  questions,
  newTab,
}: {
  questions: RelatedQuestion[];
  /** On the new-post form, open in a new tab so the draft isn't lost. */
  newTab?: boolean;
}) {
  return (
    <ul className="space-y-1">
      {questions.map((q) => (
        <li key={q.id}>
          <Link
            href={`/posts/${q.id}`}
            {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
            className="-mx-2 block rounded-xl px-2 py-2 hover:bg-accent/60"
          >
            <span className="block text-sm leading-snug font-semibold">{q.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              {q.spaceName && <span>{q.spaceName}</span>}
              {q.answered ? (
                <span className="flex items-center gap-1 font-semibold text-success">
                  <CircleCheck className="size-3.5" aria-hidden /> Answered
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" aria-hidden />
                  {q.replyCount} {q.replyCount === 1 ? "reply" : "replies"}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
