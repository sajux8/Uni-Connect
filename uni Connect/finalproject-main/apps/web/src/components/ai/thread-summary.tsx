"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AIBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import type { ThreadSummary } from "@/lib/ai/prompts";
import { formatCampus } from "@/lib/campus-time";
import { summarizeThread, type StoredThreadSummary } from "@/server/actions/ai";

const SECTIONS: { key: keyof ThreadSummary; title: string }[] = [
  { key: "main_advice", title: "Main advice" },
  { key: "differing_views", title: "Where people disagree" },
  { key: "open_questions", title: "Still open" },
];

/**
 * AI summary of a long thread (Feature 11). Always in the dashed violet card with the AI badge;
 * each point links to the replies it's based on. Stale once new replies arrive.
 */
export function ThreadSummaryCard({
  postId,
  replyCount,
  initial,
}: {
  postId: string;
  /** Visible replies right now. */
  replyCount: number;
  initial: StoredThreadSummary | null;
}) {
  const [stored, setStored] = useState(initial);
  const [pending, startTransition] = useTransition();
  const newReplies = stored ? replyCount - stored.replyCount : 0;

  function generate() {
    startTransition(async () => {
      const result = await summarizeThread(postId);
      if (!result.ok) return void toast.error(result.error);
      setStored(result.data);
    });
  }

  function show(replyId: string) {
    const element = document.getElementById(`reply-${replyId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-ai/40", "rounded-[22px]");
    window.setTimeout(
      () => element.classList.remove("ring-2", "ring-ai/40", "rounded-[22px]"),
      2200,
    );
  }

  return (
    <section
      aria-label="AI summary of this thread"
      className="rounded-[22px] border border-dashed border-ai/40 bg-ai/5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AIBadge label="AI summary" />
        {(!stored || newReplies > 0) && (
          <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
            {stored ? (
              <RefreshCw data-icon="inline-start" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {pending ? "Summarising…" : stored ? "Update summary" : "Summarise this thread"}
          </Button>
        )}
      </div>

      {!stored ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {replyCount} replies is a lot to read. Get the main advice, where people disagree and
          what&apos;s still open, with links to the replies.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-4">
            {SECTIONS.filter((s) => stored.summary[s.key].length > 0).map((section) => (
              <div key={section.key}>
                <h3 className="text-[13px] font-extrabold text-ai">{section.title}</h3>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[15px]">
                  {stored.summary[section.key].map((point, i) => (
                    <li key={i}>
                      {point.text}{" "}
                      {point.reply_ids.map((replyId, j) => (
                        <button
                          key={replyId}
                          type="button"
                          onClick={() => show(replyId)}
                          aria-label={`Show reply ${j + 1} this is based on`}
                          className="mx-0.5 inline-grid size-5 place-items-center rounded-full bg-ai/15 align-[1px] text-[11px] font-bold text-ai hover:bg-ai/25"
                        >
                          {j + 1}
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-ai/20 pt-3 text-[13px] text-muted-foreground">
            AI-generated · based on {stored.replyCount} replies ·{" "}
            {formatCampus(stored.generatedAt, "day")}. Read the replies before relying on it.
            {newReplies > 0 &&
              ` ${newReplies} new ${newReplies === 1 ? "reply" : "replies"} since this summary.`}
          </p>
        </>
      )}
    </section>
  );
}
