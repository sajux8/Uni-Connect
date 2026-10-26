import { CalendarClock, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect } from "@/components/shared/filter-select";
import { withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { DeleteEntryButton, EntryForm } from "@/components/timetable/entry-form";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { ROUTES } from "@/lib/routes";
import { moduleLabel, shortTime, WEEKDAYS } from "@/lib/timetable";
import { listEntries, listTeachingStaff, listTimetableBatches } from "@/server/queries/timetable";

export const metadata: Metadata = { title: ROUTES["/admin/timetable"].title };

const day = (d: string) => formatCampus(`${d}T12:00:00+05:30`, "day");

/** Coordinators build each batch's weekly timetable for the term (Phase D). */
export default async function Page({ searchParams }: PageProps<"/admin/timetable">) {
  const user = await requireRole("lecturer");
  const header = (description: string, children?: React.ReactNode, actions?: React.ReactNode) => (
    <PageHeader title="Timetables" description={description} actions={actions}>
      {children}
    </PageHeader>
  );
  if (!roleAtLeast(user.role, "coordinator")) {
    return (
      <>
        {header("Each batch's weekly classes.")}
        <NoAccessState description="Timetables are built by coordinators and super admins." />
      </>
    );
  }

  const batches = await listTimetableBatches(user);
  if (batches.length === 0) {
    return (
      <>
        {header("Each batch's weekly classes.")}
        <EmptyState
          icon={CalendarClock}
          title="No batches yet"
          description="Create a batch first, then add its weekly classes here."
          action={
            <Link href="/admin/batches" className={buttonVariants({ variant: "outline" })}>
              Go to Batches
            </Link>
          }
        />
      </>
    );
  }

  const params = await searchParams;
  const requested = typeof params.batch === "string" ? params.batch : undefined;
  const batch = batches.find((b) => b.id === requested) ?? batches[0];
  const [entries, staff] = await Promise.all([
    listEntries(batch.id),
    listTeachingStaff(batch.departmentId),
  ]);
  const today = campusDay(new Date());
  const defaultTerm = entries[0]
    ? { startsOn: entries[0].startsOn, endsOn: entries[0].endsOn }
    : { startsOn: today, endsOn: addCampusDays(today, 120) };

  return (
    <>
      {header(
        `${batch.name}: the classes repeat every week of the term. Changes apply from today on.`,
        batches.length > 1 ? (
          <FilterSelect
            label="Batch"
            options={batches.map((b) => ({
              href: withParams("/admin/timetable", {}, { batch: b.id }),
              label: user.role === "super_admin" ? `${b.name} (${b.departmentName})` : b.name,
              selected: b.id === batch.id,
            }))}
          />
        ) : undefined,
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/timetable?batch=${batch.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <CalendarDays data-icon="inline-start" /> View week
          </Link>
          <EntryForm
            batchId={batch.id}
            batchName={batch.name}
            staff={staff}
            defaultTerm={defaultTerm}
          />
        </div>,
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No classes yet"
          description={`Add ${batch.name}'s weekly classes with Add class. Students see them on their timetable straight away.`}
        />
      ) : (
        <div className="space-y-5">
          {WEEKDAYS.filter((d) => entries.some((e) => e.weekday === d.value)).map((d) => (
            <section
              key={d.value}
              aria-labelledby={`day-${d.value}`}
              className="rounded-[22px] border bg-card shadow-soft"
            >
              <h2 id={`day-${d.value}`} className="px-5 pt-4 text-[15px] font-extrabold">
                {d.label}
              </h2>
              <ul className="divide-y">
                {entries
                  .filter((e) => e.weekday === d.value)
                  .map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="w-24 shrink-0 text-sm font-bold text-muted-foreground tabular-nums">
                        {shortTime(e.startTime)}–{shortTime(e.endTime)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {moduleLabel(e.moduleName, e.moduleCode)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[
                            e.lecturer?.name ?? "No lecturer yet",
                            e.room,
                            `${day(e.startsOn)} – ${day(e.endsOn)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        <EntryForm
                          batchId={batch.id}
                          batchName={batch.name}
                          staff={staff}
                          entry={e}
                          defaultTerm={defaultTerm}
                        />
                        <DeleteEntryButton entryId={e.id} moduleName={e.moduleName} />
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
