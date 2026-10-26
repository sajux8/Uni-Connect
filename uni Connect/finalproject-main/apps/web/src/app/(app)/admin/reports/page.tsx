import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { SelectInput } from "@/components/forms/field";
import { CategoryChip } from "@/components/shared/badges";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import {
  reasonLabel,
  REPORT_REASONS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportStatus,
  type ReportTarget,
} from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { countReportsByStatus, listReports } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin/reports"].title };

const STATUSES: ReportStatus[] = ["open", "resolved", "dismissed"];

export default async function Page({ searchParams }: PageProps<"/admin/reports">) {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Reports"
      description="Content and people reported by members. Open reports are oldest first."
    />
  );
  if (user.role === "lecturer") {
    return (
      <>
        {header}
        <NoAccessState description="Reports are reviewed by coordinators and super admins." />
      </>
    );
  }

  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status) ?? "open";
  const reason = REPORT_REASONS.find((r) => r.value === params.reason)?.value;
  const target = (Object.keys(REPORT_TARGET_LABELS) as ReportTarget[]).find(
    (t) => t === params.target,
  );
  const current = {
    status: status === "open" ? undefined : status,
    reason,
    target,
  };
  const [reports, counts] = await Promise.all([
    listReports({ status, reason: reason as ReportReason | undefined, target }),
    countReportsByStatus(),
  ]);
  const filtered = Boolean(reason || target);

  return (
    <>
      {header}
      <div className="mb-6 space-y-3">
        <FilterTabs
          label="Report status"
          items={STATUSES.map((s) => ({
            href: withParams("/admin/reports", current, { status: s === "open" ? undefined : s }),
            label: REPORT_STATUS_LABELS[s],
            active: s === status,
            count: counts[s],
          }))}
        />
        <form action="/admin/reports" className="flex flex-wrap items-end gap-2">
          {status !== "open" && <input type="hidden" name="status" value={status} />}
          <label className="sr-only" htmlFor="reason">
            Reason
          </label>
          <SelectInput
            id="reason"
            name="reason"
            defaultValue={reason ?? ""}
            className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
          >
            <option value="">Any reason</option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectInput>
          <label className="sr-only" htmlFor="target">
            Type
          </label>
          <SelectInput
            id="target"
            name="target"
            defaultValue={target ?? ""}
            className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
          >
            <option value="">Anything</option>
            {(Object.keys(REPORT_TARGET_LABELS) as ReportTarget[]).map((t) => (
              <option key={t} value={t}>
                {REPORT_TARGET_LABELS[t]}
              </option>
            ))}
          </SelectInput>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={
            filtered
              ? "No reports match"
              : status === "open"
                ? "No open reports"
                : "Nothing here yet"
          }
          description={
            status === "open" && !filtered
              ? "When members report something, it appears here and you get a notification."
              : undefined
          }
          action={
            filtered ? (
              <Link
                href={withParams("/admin/reports", current, {
                  reason: undefined,
                  target: undefined,
                })}
                className={buttonVariants({ variant: "outline" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <article className="relative flex flex-col gap-2 rounded-[22px] border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryChip tint="amber">{reasonLabel(r.reason)}</CategoryChip>
                  <CategoryChip>{REPORT_TARGET_LABELS[r.targetType]}</CategoryChip>
                  {r.status !== "open" && (
                    <CategoryChip tint={r.status === "resolved" ? "emerald" : "zinc"}>
                      {REPORT_STATUS_LABELS[r.status]}
                    </CategoryChip>
                  )}
                  <span className="text-xs text-muted-foreground">
                    <RelativeTime date={r.createdAt} />
                  </span>
                </div>
                <h2 className="font-extrabold">
                  <Link
                    href={`/admin/reports/${r.id}`}
                    className="outline-none after:absolute after:inset-0 after:rounded-[22px] hover:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
                  >
                    {r.snapshot.title ?? "Untitled"}
                  </Link>
                </h2>
                {r.snapshot.excerpt && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.snapshot.excerpt}</p>
                )}
                <p className="text-[13px] text-muted-foreground">
                  {r.snapshot.author_name ? `By ${r.snapshot.author_name} · ` : ""}
                  Reported by {r.reporter.name ?? "a former member"}
                  {r.details
                    ? `: “${r.details.slice(0, 120)}${r.details.length > 120 ? "…" : ""}”`
                    : ""}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
