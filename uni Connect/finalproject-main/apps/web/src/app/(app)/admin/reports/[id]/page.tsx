import { ExternalLink, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportDecisionForm } from "@/components/admin/report-decision";
import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/campus";
import {
  decisionsFor,
  hideLabel,
  MODERATION_ACTION_LABELS,
  reasonLabel,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { getReport } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin/reports/[id]"].title };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: PageProps<"/admin/reports/[id]">) {
  const user = await requireRole("lecturer");
  if (user.role === "lecturer") {
    return <NoAccessState description="Reports are reviewed by coordinators and super admins." />;
  }
  const { id } = await params;
  const report = UUID.test(id) ? await getReport(id) : null;
  if (!report) notFound();

  const otherOpen = report.related.filter((r) => r.id !== report.id && r.status === "open").length;
  const decisions = decisionsFor(report.targetType, user.role, {
    hasAuthor: Boolean(report.authorId),
    inSpace: Boolean(report.spaceId),
  });
  const ownContent = report.authorId === user.id;
  const what = REPORT_TARGET_LABELS[report.targetType];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: "Reports", href: "/admin/reports" }, { label: what }]}
        title={`${reasonLabel(report.reason)}: ${what.toLowerCase()}`}
        description={`Reported ${report.related.length > 1 ? `${report.related.length} times` : "once"}.`}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section
            aria-labelledby="content-title"
            className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="content-title"
                className="text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase"
              >
                Reported {what.toLowerCase()}
              </h2>
              {report.snapshot.link && (
                <Link
                  href={report.snapshot.link}
                  className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
                >
                  Open <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
            <p className="text-lg font-extrabold text-pretty">
              {report.snapshot.title ?? "Untitled"}
            </p>
            {report.snapshot.excerpt ? (
              <blockquote className="rounded-2xl border-l-4 border-primary bg-surface-tint px-4 py-3 text-[15px] whitespace-pre-line">
                {report.snapshot.excerpt}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">No text.</p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />A copy taken when it was first reported. It
              may have been edited or removed since.
            </p>
            {report.spaceName && (
              <p className="text-sm text-muted-foreground">In the space {report.spaceName}.</p>
            )}
          </section>

          <section
            aria-labelledby="reports-title"
            className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6"
          >
            <h2 id="reports-title" className="text-[17px] font-extrabold tracking-tight">
              Reports about this
            </h2>
            <ul className="divide-y">
              {report.related.map((r) => (
                <li key={r.id} className="space-y-1 py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{r.reporter.name ?? "Former member"}</span>
                    <CategoryChip tint="amber">{reasonLabel(r.reason)}</CategoryChip>
                    <CategoryChip
                      tint={
                        r.status === "open" ? "blue" : r.status === "resolved" ? "emerald" : "zinc"
                      }
                    >
                      {REPORT_STATUS_LABELS[r.status]}
                    </CategoryChip>
                    <span className="text-xs text-muted-foreground">
                      <RelativeTime date={r.createdAt} />
                    </span>
                  </p>
                  {r.details && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{r.details}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft">
            {report.status === "open" ? (
              ownContent ? (
                <p className="text-sm text-muted-foreground">
                  This report is about your own content, so another moderator needs to decide it.
                </p>
              ) : (
                <ReportDecisionForm
                  reportId={report.id}
                  targetType={report.targetType}
                  decisions={decisions}
                  related={otherOpen}
                />
              )
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-extrabold">{REPORT_STATUS_LABELS[report.status]}</p>
                {report.action && (
                  <p>
                    {report.action === "hide_content"
                      ? hideLabel(report.targetType)
                      : MODERATION_ACTION_LABELS[report.action]}
                    {report.handledBy ? ` by ${report.handledBy}` : ""}
                    {report.handledAt && (
                      <>
                        {" · "}
                        <RelativeTime date={report.handledAt} />
                      </>
                    )}
                  </p>
                )}
                {report.resolutionNote && (
                  <p className="rounded-xl bg-surface-tint px-3 py-2 text-muted-foreground">
                    {report.resolutionNote}
                  </p>
                )}
              </div>
            )}
          </section>

          {report.author && (
            <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft">
              <h2 className="text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                Author
              </h2>
              <p className="font-extrabold">
                {user.role === "super_admin" ? (
                  <Link href={`/admin/users/${report.author.id}`} className="hover:text-primary">
                    {report.author.name}
                  </Link>
                ) : report.author.username ? (
                  <Link href={`/u/${report.author.username}`} className="hover:text-primary">
                    {report.author.name}
                  </Link>
                ) : (
                  report.author.name
                )}
              </p>
              <p className="flex flex-wrap gap-1.5">
                {report.author.role && (
                  <CategoryChip>{ROLE_LABELS[report.author.role]}</CategoryChip>
                )}
                {report.author.status && report.author.status !== "approved" && (
                  <CategoryChip tint="red">{report.author.status}</CategoryChip>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Reported {report.author.reportsAgainst}{" "}
                {report.author.reportsAgainst === 1 ? "time" : "times"} in total.
              </p>
              {report.author.recentActions.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {report.author.recentActions.map((a) => (
                    <li key={a.id}>
                      <span className="font-semibold">{MODERATION_ACTION_LABELS[a.action]}</span>{" "}
                      <span className="text-muted-foreground">
                        · <RelativeTime date={a.createdAt} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
