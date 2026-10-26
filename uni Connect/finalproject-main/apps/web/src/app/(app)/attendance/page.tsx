import { AlertTriangle, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CategoryChip } from "@/components/shared/badges";
import { FilterSelect } from "@/components/shared/filter-select";
import { withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { requireApproved } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { formatCampus } from "@/lib/campus-time";
import { ROUTES } from "@/lib/routes";
import {
  ALERT_STREAK,
  attendanceSummary,
  currentStreak,
  moduleLabel,
  rate,
  rateTone,
  type AttendanceRate,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import {
  batchAttendanceOverview,
  listTimetableBatches,
  myAttendance,
  recentClassesTaught,
} from "@/server/queries/timetable";

export const metadata: Metadata = { title: ROUTES["/attendance"].title };

const TONE_TEXT = {
  good: "text-success",
  warning: "text-warning",
  bad: "text-destructive",
  none: "text-muted-foreground",
} as const;

function Percent({ value, className }: { value: AttendanceRate; className?: string }) {
  return (
    <span
      className={cn("font-extrabold tabular-nums", TONE_TEXT[rateTone(value.percent)], className)}
    >
      {value.percent === null ? "–" : `${value.percent}%`}
    </span>
  );
}

/**
 * Attendance (Phase D): students see their own record; coordinators and super admins see a batch,
 * with students who missed several classes in a row at the top; lecturers see their recent classes.
 */
export default async function Page({ searchParams }: PageProps<"/attendance">) {
  const user = await requireApproved();
  const params = await searchParams;

  if (user.role === "student") return <StudentView hasBatch={!!user.batchId} />;

  if (!roleAtLeast(user.role, "coordinator")) return <LecturerView userId={user.id} />;

  const batches = await listTimetableBatches(user);
  const requested = typeof params.batch === "string" ? params.batch : undefined;
  const batch = batches.find((b) => b.id === requested) ?? batches[0];
  if (!batch) {
    return (
      <>
        <PageHeader title="Attendance" description="Attendance for your department's batches." />
        <EmptyState
          icon={ClipboardCheck}
          title="No batches yet"
          description="Create batches under Admin → Batches, then add their timetables."
        />
      </>
    );
  }

  const students = await batchAttendanceOverview(batch.id);
  const sorted = [...students].sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  const atRisk = students.filter((s) => s.streak >= ALERT_STREAK).length;
  const overall = rate(
    students.reduce((n, s) => n + s.attended, 0),
    students.reduce((n, s) => n + s.held, 0),
  );

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${batch.name}: everyone's attendance since they joined the batch.`}
      >
        {batches.length > 1 && (
          <FilterSelect
            label="Batch"
            options={batches.map((b) => ({
              href: withParams("/attendance", {}, { batch: b.id }),
              label: user.role === "super_admin" ? `${b.name} (${b.departmentName})` : b.name,
              selected: b.id === batch.id,
            }))}
          />
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Batch attendance">
          <Percent value={overall} className="text-3xl" />
        </Stat>
        <Stat label="Students">
          <span className="text-3xl font-extrabold">{students.length}</span>
        </Stat>
        <Stat label={`Missed ${ALERT_STREAK}+ in a row`}>
          <span className={cn("text-3xl font-extrabold", atRisk > 0 && "text-destructive")}>
            {atRisk}
          </span>
        </Stat>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No students in this batch"
          description="Students appear here once they're approved into the batch."
        />
      ) : (
        <section className="rounded-[22px] border bg-card shadow-soft" aria-label="Students">
          <ul className="divide-y">
            {sorted.map((s) => {
              const r = rate(s.attended, s.held);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <UserAvatar name={s.name} src={s.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${s.username}`}
                      className="block truncate text-sm font-bold hover:text-primary"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.attended} of {s.held} classes
                      {s.lastAlertAt
                        ? ` · coordinator alerted ${formatCampus(s.lastAlertAt, "day")}`
                        : ""}
                    </p>
                  </div>
                  {s.streak >= ALERT_STREAK ? (
                    <CategoryChip tint="red">Missed {s.streak} in a row</CategoryChip>
                  ) : s.streak === ALERT_STREAK - 1 ? (
                    <CategoryChip tint="amber">Missed {s.streak} in a row</CategoryChip>
                  ) : null}
                  <Percent value={r} className="w-12 text-right" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

async function StudentView({ hasBatch }: { hasBatch: boolean }) {
  const header = (
    <PageHeader title="Attendance" description="Your attendance in every module this term." />
  );
  if (!hasBatch) {
    return (
      <>
        {header}
        <EmptyState
          icon={ClipboardCheck}
          title="You're not in a batch yet"
          description="Your attendance appears here once your coordinator places you in a batch."
        />
      </>
    );
  }

  const records = await myAttendance();
  if (records.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ClipboardCheck}
          title="No classes yet"
          description="Once your classes start, your attendance shows up here. Mark yourself present from the timetable while each class is on."
          action={
            <Link href="/timetable" className="font-bold text-primary hover:underline">
              Open the timetable
            </Link>
          }
        />
      </>
    );
  }

  const summary = attendanceSummary(records);
  const streak = currentStreak(records);

  return (
    <>
      {header}
      {streak >= 2 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            You&apos;ve missed your last {streak} classes.{" "}
            {streak >= ALERT_STREAK
              ? "Your coordinator has been told. If something's wrong, talk to them."
              : `After ${ALERT_STREAK} in a row, your coordinator is told.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Stat label="Overall">
            <Percent value={summary.overall} className="text-4xl" />
            <span className="block text-sm text-muted-foreground">
              {summary.overall.attended} of {summary.overall.held} classes
            </span>
          </Stat>
          <section
            className="rounded-[22px] border bg-card p-5 shadow-soft"
            aria-labelledby="by-module"
          >
            <h2 id="by-module" className="mb-3 text-[15px] font-extrabold">
              By module
            </h2>
            <ul className="space-y-2.5">
              {summary.modules.map((m) => (
                <li key={`${m.code}-${m.name}`} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {moduleLabel(m.name, m.code)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.attended} of {m.held}
                    </span>
                  </span>
                  <Percent value={m} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-[22px] border bg-card shadow-soft" aria-labelledby="history">
          <h2 id="history" className="px-5 pt-5 text-[15px] font-extrabold">
            Recent classes
          </h2>
          <ul className="divide-y">
            {records.slice(0, 40).map((r) => (
              <li key={r.sessionId} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/timetable/sessions/${r.sessionId}`}
                    className="block truncate font-semibold hover:text-primary"
                  >
                    {r.moduleName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatCampus(r.startsAt, "dayTime")}
                  </span>
                </span>
                {r.present ? (
                  <CategoryChip tint="emerald">Present</CategoryChip>
                ) : (
                  <CategoryChip tint="red">Absent</CategoryChip>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

async function LecturerView({ userId }: { userId: string }) {
  const classes = await recentClassesTaught(userId);
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Your recent classes. Open one to see its register and correct it."
      />
      {classes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No classes yet"
          description="Classes you teach appear here once they've started."
        />
      ) : (
        <section className="rounded-[22px] border bg-card shadow-soft" aria-label="Your classes">
          <ul className="divide-y">
            {classes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/timetable/sessions/${c.id}`}
                    className="block truncate font-bold hover:text-primary"
                  >
                    {moduleLabel(c.moduleName, c.moduleCode)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.batchName} · {formatCampus(c.startsAt, "dayTime")}
                  </span>
                </span>
                {c.status === "cancelled" ? (
                  <CategoryChip tint="red">Cancelled</CategoryChip>
                ) : (
                  <span className="font-bold tabular-nums">
                    {c.presentCount} / {c.batchSize} present
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border bg-card p-5 shadow-soft">
      <p className="text-[13px] font-bold text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
