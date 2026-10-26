"use client";

import { ArrowUp, CircleAlert, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AnswerText } from "@/components/ai/answer-text";
import { SourceList } from "@/components/ai/source-list";
import { TextArea } from "@/components/forms/field";
import { AIBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import type { AiSourceRef } from "@/lib/ai/config";
import { NOT_FOUND_TEXT } from "@/lib/ai/prompts";
import { citedNumbers, stripInvalidCitations } from "@/lib/ai/retrieval";

interface Turn {
  id: number;
  question: string;
  answer: string;
  sources: AiSourceRef[];
  found: boolean;
  status: "thinking" | "writing" | "done" | "error";
  error?: string;
}

/**
 * Which sources to list under an answer: the ones it cites once it's finished (keeping their
 * numbers), everything it was given while it's still being written, and the three closest when
 * nothing answered the question.
 */
function shownSources(turn: Turn): { sources: AiSourceRef[]; title: string } {
  if (!turn.found || turn.answer.startsWith(NOT_FOUND_TEXT)) {
    return { sources: turn.sources.slice(0, 3), title: "Might be related" };
  }
  const cited = citedNumbers(turn.answer);
  const used = turn.sources.filter((s) => cited.includes(s.n));
  return {
    sources: turn.status === "done" && used.length > 0 ? used : turn.sources,
    title: "Sources",
  };
}

const EXAMPLES = [
  "When does course registration close?",
  "Where can I find past papers?",
  "What events are coming up?",
];

/**
 * Ask AI. The conversation lives only in this component: nothing is saved,
 * and a refresh clears it. Follow-ups send the previous question and answer for context.
 */
export function AskPanel({
  initialQuestion,
  initialRemaining,
  limit,
}: {
  initialQuestion?: string;
  initialRemaining: number;
  limit: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [highlight, setHighlight] = useState<string>();
  const nextId = useRef(1);
  const started = useRef(false);
  const busy = turns.some((t) => t.status === "thinking" || t.status === "writing");

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    const id = nextId.current++;
    const last = turns.findLast((t) => t.status === "done" && t.found);
    const update = (patch: Partial<Turn>) =>
      setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setTurns((all) => [
      ...all,
      { id, question: text, answer: "", sources: [], found: true, status: "thinking" },
    ]);
    setDraft("");

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          previous: last
            ? { question: last.question, answer: last.answer.slice(0, 4000) }
            : undefined,
        }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          remaining?: number;
        } | null;
        if (typeof body?.remaining === "number") setRemaining(body.remaining);
        update({
          status: "error",
          error: body?.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      // First line: JSON with the sources. Everything after it: the answer, as it's written.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let header = true;
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (header) {
          const newline = buffer.indexOf("\n");
          if (newline === -1) continue;
          const meta = JSON.parse(buffer.slice(0, newline)) as {
            found: boolean;
            remaining: number;
            sources: AiSourceRef[];
          };
          setRemaining(meta.remaining);
          update({ sources: meta.sources, found: meta.found, status: "writing" });
          buffer = buffer.slice(newline + 1);
          header = false;
        }
        answer += buffer;
        buffer = "";
        update({ answer });
      }
      update({ answer: answer.trim(), status: "done" });
    } catch {
      update({ status: "error", error: "The connection dropped. Please try again." });
    }
  }

  // A question handed over by the command palette (`/ask?q=…`) is asked once.
  useEffect(() => {
    if (started.current || !initialQuestion) return;
    started.current = true;
    void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first render
  }, []);

  function jumpTo(turnId: number, n: number) {
    const id = `source-${turnId}-${n}`;
    setHighlight(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlight((h) => (h === id ? undefined : h)), 2000);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {turns.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-ai/40 bg-ai/5 p-5 sm:p-7">
          <AIBadge label="AI assistant" />
          <p className="mt-3 text-[15px]">
            Ask about anything posted on UniConnect: announcements, events, questions other students
            asked, and shared resources. Answers come only from what you&apos;re allowed to see,
            with links to where they came from.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button
                key={example}
                variant="outline"
                size="sm"
                disabled={remaining <= 0}
                onClick={() => void ask(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      )}

      {turns.map((turn) => (
        <section key={turn.id} aria-label={`Question: ${turn.question}`} className="space-y-3">
          <p className="ml-auto w-fit max-w-[85%] rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">
            {turn.question}
          </p>
          {turn.status === "error" ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              {turn.error}
            </p>
          ) : (
            <div className="space-y-4 rounded-[22px] border border-dashed border-ai/40 bg-ai/5 p-5 sm:p-6">
              <AIBadge />
              {turn.status === "thinking" ? (
                <p className="animate-pulse text-sm text-muted-foreground" aria-live="polite">
                  Searching UniConnect…
                </p>
              ) : (
                <div aria-live="polite" aria-busy={turn.status === "writing"}>
                  <AnswerText
                    text={stripInvalidCitations(turn.answer, turn.sources.length)}
                    sourceCount={turn.sources.length}
                    onCite={(n) => jumpTo(turn.id, n)}
                  />
                </div>
              )}
              {turn.sources.length > 0 && turn.status !== "thinking" && (
                <SourceList turnId={turn.id} highlight={highlight} {...shownSources(turn)} />
              )}
              {turn.status === "done" && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ai/20 pt-3 text-[13px] text-muted-foreground">
                  <p>
                    AI-generated from UniConnect content you can access. Check the sources before
                    acting.
                  </p>
                  <Link
                    href={`/posts/new?type=question&title=${encodeURIComponent(turn.question.slice(0, 150))}`}
                    className="inline-flex min-h-10 items-center gap-1.5 font-bold text-primary hover:underline dark:text-accent-foreground"
                  >
                    <MessagesSquare className="size-4" aria-hidden /> Ask the community instead
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      ))}

      <form
        className="sticky bottom-20 space-y-2 rounded-[22px] border bg-card p-3 shadow-soft md:bottom-4"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <TextArea
            aria-label="Your question"
            rows={1}
            maxLength={500}
            value={draft}
            disabled={remaining <= 0}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
            placeholder={turns.length ? "Ask a follow-up…" : "Ask a question…"}
            className="min-h-11 resize-none border-0 shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Ask"
            disabled={busy || draft.trim().length < 3 || remaining <= 0}
          >
            <ArrowUp />
          </Button>
        </div>
        <p className="px-2 text-xs text-muted-foreground">
          {remaining > 0
            ? `${remaining} of ${limit} questions left today.`
            : `You've used today's ${limit} questions. They reset at midnight.`}{" "}
          Questions aren&apos;t saved, and private messages are never searched.
        </p>
      </form>
    </div>
  );
}
