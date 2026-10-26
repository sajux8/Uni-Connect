import { Download, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { inputClass, SelectInput } from "@/components/forms/field";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import {
  MODERATION_ACTION_LABELS,
  parseLogFilters,
  targetLink,
  type ModerationActionType,
} from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { listModerators } from "@/server/queries/admin";
import { loadModerationLog } from "@/server/queries/moderation-log";

export const metadata: Metadata = { title: ROUTES["/admin/moderation-log"].title };

export default async function Page({ searchParams }: PageProps<"/admin/moderation-log">) {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Moderation log"
      description="Every moderation and account decision, newest first. Entries can't be edited or deleted."
    />
  );
  if (user.role === "lecturer") {
    return (
      <>
        {header}
        <NoAccessState description="The moderation log is for coordinators and super admins." />
      </>
    );
  }

  const params = await searchParams;
  const filters = parseLogFilters(params);
  const [entries, moderators] = await Promise.all([
    loadModerationLog(filters, 200),
    listModerators(),
  ]);
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();
  const filtered = query.length > 0;

  return (
    <>
      {header}
      <form action="/admin/moderation-log" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="sr-only" htmlFor="action">
          Action
        </label>
        <SelectInput
          id="action"
          name="action"
          defaultValue={filters.action ?? ""}
          className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
        >
          <option value="">Any action</option>
          {(Object.keys(MODERATION_ACTION_LABELS) as ModerationActionType[]).map((a) => (
            <option key={a} value={a}>
              {MODERATION_ACTION_LABELS[a]}
            </option>
          ))}
        </SelectInput>
        <label className="sr-only" htmlFor="actor">
          Moderator
        </label>
        <SelectInput
          id="actor"
          name="actor"
          defaultValue={filters.actor ?? ""}
          className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
        >
          <option value="">Anyone</option>
          {moderators.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectInput>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={cn(inputClass, "h-10 w-auto rounded-full")}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className={cn(inputClass, "h-10 w-auto rounded-full")}
          />
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <a
          href={`/api/admin/moderation-log.csv${query ? `?${query}` : ""}`}
          className={cn(buttonVariants({ variant: "ghost" }), "ml-auto")}
        >
          <Download data-icon="inline-start" /> CSV
        </a>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "Nothing matches" : "No actions yet"}
          description={filtered ? "Try a wider date range or another action." : undefined}
          action={
            filtered ? (
              <Link href="/admin/moderation-log" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ol className="divide-y rounded-[22px] border bg-card shadow-soft">
          {entries.map((e) => {
            const link =
              e.reportId != null
                ? `/admin/reports/${e.reportId}`
                : targetLink(e.targetType, e.targetId);
            return (
              <li
                key={e.id}
                className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-start sm:gap-4 sm:px-5"
              >
                <time
                  dateTime={e.createdAt}
                  className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums sm:w-36 sm:pt-0.5"
                >
                  {formatCampus(e.createdAt, "dayTime")}
                </time>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-bold">
                      {e.actor.name ?? (e.actor.id ? "Former member" : "System")}
                    </span>{" "}
                    <span className="text-muted-foreground">·</span>{" "}
                    <span className="font-semibold">{MODERATION_ACTION_LABELS[e.action]}</span>{" "}
                    <span className="text-muted-foreground">
                      ({e.targetType}
                      {link ? (
                        <>
                          {" · "}
                          <Link
                            href={link}
                            className="font-semibold text-primary hover:underline dark:text-accent-foreground"
                          >
                            {e.reportId ? "report" : "open"}
                          </Link>
                        </>
                      ) : null}
                      )
                    </span>
                  </p>
                  {e.reason && (
                    <p className="text-sm break-words text-muted-foreground">{e.reason}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
