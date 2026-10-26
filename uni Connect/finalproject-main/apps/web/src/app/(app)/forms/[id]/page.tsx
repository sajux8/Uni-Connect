import { BarChart3, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { FormAnswerer } from "@/components/feedback/form-answerer";
import { FormStatusActions } from "@/components/feedback/form-status-actions";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { StateFrame } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import { effectiveStatus, questionTypeLabel } from "@/lib/forms";
import {
  canManageForm,
  canSeeResults,
  getForm,
  getResults,
  hasAnswered,
} from "@/server/queries/forms";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getForm(id);
}

export async function generateMetadata({ params }: PageProps<"/forms/[id]">): Promise<Metadata> {
  await requireApproved();
  const form = await load((await params).id);
  return { title: form?.title ?? "Feedback form" };
}

const STATUS = {
  draft: { label: "Draft", tint: "zinc" },
  open: { label: "Open", tint: "emerald" },
  closed: { label: "Closed", tint: "zinc" },
} as const;

/** A feedback form (Phase E): students answer it once; staff manage it and open the results. */
export default async function Page({ params }: PageProps<"/forms/[id]">) {
  const user = await requireApproved();
  const form = await load((await params).id);
  if (!form) notFound();

  const status = effectiveStatus(form);
  const crumbs = [{ label: "Feedback", href: "/forms" }, { label: form.title }];

  if (user.role === "student") {
    const answered = await hasAnswered(form.id, user.id);
    return (
      <>
        <PageHeader title={form.title} breadcrumbs={crumbs} />
        <div className="max-w-3xl space-y-5">
          {form.description && (
            <p className="text-[15px] whitespace-pre-line text-muted-foreground">
              {form.description}
            </p>
          )}
          {answered ? (
            <StateFrame
              icon={CheckCircle2}
              tone="neutral"
              title="Thanks, your answers were sent"
              description="They're stored without your name, so nobody can see which answers are yours. You can only answer once."
            />
          ) : status !== "open" ? (
            <StateFrame
              icon={CheckCircle2}
              tone="neutral"
              title="This form is closed"
              description="It isn't taking answers any more."
            />
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <p>
                  <strong>Anonymous.</strong> Your answers are saved without your name. Staff only
                  see that you answered, not what you said.
                  {form.closesAt && ` Closes ${formatCampus(form.closesAt, "dayTime")}.`}
                </p>
              </div>
              <FormAnswerer formId={form.id} questions={form.questions} />
            </>
          )}
        </div>
      </>
    );
  }

  const [manage, results] = await Promise.all([canManageForm(form.id), canSeeResults(form.id)]);
  const counts = results ? (await getResults(form.id)).counts : [];
  const responded = counts.reduce((n, c) => n + c.responded, 0);
  const asked = counts.reduce((n, c) => n + c.students, 0);

  return (
    <>
      <PageHeader
        title={form.title}
        breadcrumbs={crumbs}
        badge={<CategoryChip tint={STATUS[status].tint}>{STATUS[status].label}</CategoryChip>}
        actions={
          manage ? (
            <FormStatusActions
              formId={form.id}
              title={form.title}
              status={status}
              answered={responded > 0}
            />
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="lg:order-2" aria-label="About this form">
          <div className="space-y-4 rounded-[22px] border bg-card p-5 text-sm shadow-soft">
            <dl className="space-y-3">
              <div>
                <dt className="text-[13px] font-bold text-muted-foreground">For</dt>
                <dd className="font-semibold">
                  {form.batchNames.length
                    ? form.batchNames.join(", ")
                    : `Everyone in ${form.departmentName}`}
                </dd>
              </div>
              {form.aboutLecturer && (
                <div>
                  <dt className="text-[13px] font-bold text-muted-foreground">About</dt>
                  <dd className="font-semibold">{form.aboutLecturer.name}</dd>
                </div>
              )}
              {form.createdBy && (
                <div>
                  <dt className="text-[13px] font-bold text-muted-foreground">Created by</dt>
                  <dd className="font-semibold">{form.createdBy.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-[13px] font-bold text-muted-foreground">Closes</dt>
                <dd className="font-semibold">
                  {form.closesAt ? formatCampus(form.closesAt, "dayTime") : "When you close it"}
                </dd>
              </div>
              {results && status !== "draft" && (
                <div>
                  <dt className="text-[13px] font-bold text-muted-foreground">Responses</dt>
                  <dd className="font-semibold">
                    {responded} of {asked} students
                  </dd>
                </div>
              )}
            </dl>
            {results && status !== "draft" && (
              <Link
                href={`/forms/${form.id}/results`}
                className={buttonVariants({ variant: "outline", className: "w-full" })}
              >
                <BarChart3 data-icon="inline-start" /> View results
              </Link>
            )}
          </div>
        </aside>

        <section aria-labelledby="questions" className="min-w-0 space-y-3 lg:order-1">
          {form.description && (
            <p className="text-[15px] whitespace-pre-line text-muted-foreground">
              {form.description}
            </p>
          )}
          <h2 id="questions" className="text-[15px] font-extrabold">
            Questions
          </h2>
          <ol className="space-y-2">
            {form.questions.map((q) => (
              <li
                key={q.id}
                className={
                  q.type === "section"
                    ? "pt-3 font-extrabold"
                    : "rounded-2xl border bg-card px-4 py-3 text-sm shadow-soft"
                }
              >
                {q.type === "section" ? (
                  q.prompt
                ) : (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {q.prompt}
                      {q.required && <span className="text-destructive"> *</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {questionTypeLabel(q.type)}
                      {q.options.length ? ` · ${q.options.join(", ")}` : ""}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
