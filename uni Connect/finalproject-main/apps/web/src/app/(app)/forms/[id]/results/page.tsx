import { BarChart3, Download, MessageSquareText, Star } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { FormSummaryCard } from "@/components/ai/form-summary";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { aiConfig, aiConfigured } from "@/lib/ai/config";
import { requireApproved } from "@/lib/auth/session";
import {
  isAnswerable,
  questionTypeLabel,
  summariseQuestion,
  type QuestionResult,
} from "@/lib/forms";
import { ROUTES } from "@/lib/routes";
import { getFormSummary } from "@/server/queries/ai";
import { canSeeResults, getForm, getResults } from "@/server/queries/forms";

export const metadata: Metadata = { title: ROUTES["/forms/[id]/results"].title };

/**
 * Results of a feedback form (Phase E): responses per batch, a bar list per choice or scale
 * question and the written answers. Never who answered what: answers carry no user id.
 */
export default async function Page({ params }: PageProps<"/forms/[id]/results">) {
  await requireApproved();
  const { id } = await params;
  const form = z.uuid().safeParse(id).success ? await getForm(id) : null;
  if (!form) notFound();
  const crumbs = [
    { label: "Feedback", href: "/forms" },
    { label: form.title, href: `/forms/${form.id}` },
    { label: "Results" },
  ];
  if (!(await canSeeResults(form.id))) {
    return (
      <>
        <PageHeader title="Results" breadcrumbs={crumbs} />
        <NoAccessState description="Results are for the form's creator, the lecturer it's about and the department's coordinator." />
      </>
    );
  }

  const { answers, counts } = await getResults(form.id);
  const responded = counts.reduce((n, c) => n + c.responded, 0);
  const asked = counts.reduce((n, c) => n + c.students, 0);
  const writtenAnswers = answers
    .filter((a) => a.text && !a.options && a.number === null)
    .filter((a) =>
      form.questions.some(
        (q) => q.id === a.questionId && (q.type === "short" || q.type === "paragraph"),
      ),
    ).length;
  const formSummary = aiConfigured() && writtenAnswers > 0 ? await getFormSummary(form.id) : null;
  let number = 0;

  return (
    <>
      <PageHeader
        title={`Results: ${form.title}`}
        description={
          form.aboutLecturer
            ? `About ${form.aboutLecturer.name}. Answers are anonymous.`
            : "Answers are anonymous."
        }
        breadcrumbs={crumbs}
        actions={
          responded > 0 ? (
            <a
              href={`/api/forms/${form.id}/results.csv`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download data-icon="inline-start" /> Download CSV
            </a>
          ) : undefined
        }
      />

      <section
        aria-labelledby="responses"
        className="mb-6 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="responses" className="text-[15px] font-extrabold">
            Responses
          </h2>
          <p className="text-sm">
            <span className="text-2xl font-extrabold">{responded}</span>
            <span className="text-muted-foreground"> of {asked} students</span>
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {counts.map((c) => (
            <li key={c.batchId ?? "none"}>
              <Bar
                label={c.batchName}
                value={c.responded}
                total={c.students}
                caption={`${c.responded} of ${c.students}`}
              />
            </li>
          ))}
        </ul>
      </section>

      {responded === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No answers yet"
          description="Results appear here as students answer. Students were told when the form opened."
        />
      ) : (
        <div className="space-y-5">
          {aiConfigured() && writtenAnswers > 0 && (
            <FormSummaryCard
              formId={form.id}
              writtenAnswers={writtenAnswers}
              minimum={aiConfig.minAnswersForFormSummary}
              initial={formSummary}
            />
          )}
          {form.questions.map((q) => {
            if (!isAnswerable(q.type)) {
              return (
                <h2 key={q.id} className="pt-3 text-lg font-extrabold">
                  {q.prompt}
                </h2>
              );
            }
            number++;
            return (
              <section
                key={q.id}
                aria-label={q.prompt}
                className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
              >
                <p className="font-bold">
                  <span className="text-muted-foreground">{number}. </span>
                  {q.prompt}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">{questionTypeLabel(q.type)}</p>
                <QuestionSummary
                  result={summariseQuestion(q, answers)}
                  rating={q.type === "rating"}
                />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function QuestionSummary({ result, rating }: { result: QuestionResult; rating: boolean }) {
  if (result.kind === "text") {
    if (result.answers.length === 0) {
      return <p className="text-sm text-muted-foreground">No written answers.</p>;
    }
    return (
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {result.answers.map((a, i) => (
          <li key={i} className="flex gap-2 rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm">
            <MessageSquareText
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="whitespace-pre-line">{a}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {result.average !== undefined && (
        <p className="mb-3 flex items-center gap-1.5 text-sm">
          {rating && <Star className="size-4 fill-warning text-warning" aria-hidden />}
          <span className="text-xl font-extrabold">{result.average}</span>
          <span className="text-muted-foreground">
            average from {result.total} answer{result.total === 1 ? "" : "s"}
          </span>
        </p>
      )}
      <ul className="space-y-2">
        {result.counts.map((c) => (
          <li key={c.label}>
            <Bar
              label={rating ? `${c.label} star${c.label === "1" ? "" : "s"}` : c.label}
              value={c.count}
              total={result.total}
              caption={`${c.count} · ${result.total ? Math.round((c.count / result.total) * 100) : 0}%`}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/** One horizontal bar: label, a thin bar anchored at zero, and its value in text colour. */
function Bar({
  label,
  value,
  total,
  caption,
}: {
  label: string;
  value: number;
  total: number;
  caption: string;
}) {
  const share = total > 0 ? value / total : 0;
  return (
    <div
      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
      title={`${label}: ${caption}`}
    >
      <span className="truncate font-semibold">{label}</span>
      <span className="h-2.5 rounded-full bg-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }}
        />
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{caption}</span>
    </div>
  );
}
