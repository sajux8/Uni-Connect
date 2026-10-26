import { CalendarClock, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect } from "@/components/shared/filter-select";
import { withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { MarkPresentButton } from "@/components/timetable/mark-present-button";
import { SessionCard } from "@/components/timetable/session-card";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { ROUTES } from "@/lib/routes";
import { parseWeek, sessionState, weekDays } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import {
  listTimetableBatches,
  listWeekSessions,
  myPresence,
  type ClassSession,
} from "@/server/queries/timetable";

export const metadata: Metadata = { title: ROUTES["/timetable"].title };

const COLUMNS: Record<number, string> = {
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
};

/**
 * The week's classes (Phase D): students see their batch and mark themselves present while a class
 * is on; lecturers see the classes they teach; coordinators pick any batch in their department.
 */
export default async function Page({ searchParams }: PageProps<"/timetable">) {
  const user = await requireApproved();
  const params = await searchParams;
  const now = new Date();
  const monday = parseWeek(params.week, now);
  const today = campusDay(now);
  const isStudent = user.role === "student";
  const manager = roleAtLeast(user.role, "coordinator");

  const batches = await listTimetableBatches(user);
  const requested = typeof params.batch === "string" ? params.batch : undefined;
  // Staff can look at "my classes" (the ones they teach) or a batch they can see.
  const batch = isStudent
    ? batches[0]
    : requested === "mine"
      ? undefined
      : (batches.find((b) => b.id === requested) ??
        (manager && !requested ? batches[0] : undefined));
  const scope = batch ? { batchId: batch.id } : { lecturerId: user.id };
  const current = { week: params.week as string | undefined, batch: requested };

  const header = (description: string, children?: React.ReactNode, actions?: React.ReactNode) => (
    <PageHeader title="Timetable" description={description} actions={actions}>
      {children}
    </PageHeader>
  );

  if (isStudent && !batch) {
    return (
      <>
        {header("Your week of classes.")}
        <EmptyState
          icon={CalendarClock}
          title="You're not in a batch yet"
          description="Your coordinator places you in a batch when your account is approved. Your timetable appears here after that."
        />
      </>
    );
  }

  const sessions = await listWeekSessions(monday, scope);
  const present = isStudent
    ? await myPresence(
        user.id,
        sessions.map((s) => s.id),
      )
    : new Set<string>();

  const days = weekDays(monday);
  const shownDays = days.filter(
    (day, i) => i < 5 || sessions.some((s) => campusDay(s.startsAt) === day),
  );
  const byDay = new Map<string, ClassSession[]>();
  for (const s of sessions) {
    const day = campusDay(s.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  const weekLink = (week: string | undefined) => withParams("/timetable", current, { week });
  const thisWeek = parseWeek(undefined, now);
  const scopeLabel = batch ? batch.name : "Classes you teach";

  const picker = !isStudent ? (
    <FilterSelect
      label="Whose timetable"
      options={[
        {
          href: withParams("/timetable", current, { batch: "mine" }),
          label: "Classes I teach",
          selected: !batch,
        },
        ...batches.map((b) => ({
          href: withParams("/timetable", current, { batch: b.id }),
          label: user.role === "super_admin" ? `${b.name} (${b.departmentName})` : b.name,
          selected: b.id === batch?.id,
        })),
      ]}
    />
  ) : undefined;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={weekLink(addCampusDays(monday, -7))}
        className={buttonVariants({ variant: "outline", size: "icon" })}
        aria-label="Previous week"
      >
        <ChevronLeft />
      </Link>
      {monday !== thisWeek && (
        <Link href={weekLink(undefined)} className={buttonVariants({ variant: "outline" })}>
          This week
        </Link>
      )}
      <Link
        href={weekLink(addCampusDays(monday, 7))}
        className={buttonVariants({ variant: "outline", size: "icon" })}
        aria-label="Next week"
      >
        <ChevronRight />
      </Link>
      {manager && batch && (
        <Link
          href={`/admin/timetable?batch=${batch.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Pencil data-icon="inline-start" /> Edit timetable
        </Link>
      )}
    </div>
  );

  return (
    <>
      {header(
        `${scopeLabel} · week of ${formatCampus(`${monday}T12:00:00+05:30`, "dayLong").replace(/^\w+ /, "")}`,
        picker,
        actions,
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No classes this week"
          description={
            manager && batch
              ? "Add this batch's weekly classes under Edit timetable."
              : isStudent
                ? "Your coordinator hasn't added classes for this week yet."
                : "Classes you teach show up here once a coordinator adds them to a timetable."
          }
        />
      ) : (
        <div className={cn("grid gap-5 md:grid-cols-2", COLUMNS[shownDays.length])}>
          {shownDays.map((day) => {
            const list = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <section key={day} aria-label={formatCampus(`${day}T12:00:00+05:30`, "dayLong")}>
                <h2
                  className={cn(
                    "mb-2 flex items-center gap-2 text-sm font-extrabold",
                    isToday ? "text-primary dark:text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatCampus(`${day}T12:00:00+05:30`, "day")}
                  {isToday && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                      Today
                    </span>
                  )}
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-3.5 py-3 text-[13px] text-muted-foreground">
                    No classes
                  </p>
                ) : (
                  <div className="space-y-3">
                    {list.map((s) => {
                      const state = sessionState(s, now);
                      const isPresent = present.has(s.id);
                      return (
                        <SessionCard
                          key={s.id}
                          session={s}
                          state={state}
                          present={isStudent ? isPresent : undefined}
                          showBatch={!batch}
                          hideLecturer={!batch}
                          action={
                            isStudent && state === "live" && !isPresent ? (
                              <MarkPresentButton sessionId={s.id} moduleName={s.moduleName} />
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
