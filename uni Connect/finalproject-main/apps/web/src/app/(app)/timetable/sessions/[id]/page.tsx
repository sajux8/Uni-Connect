import { Clock, History, MapPin, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { MarkPresentButton } from "@/components/timetable/mark-present-button";
import { RegisterList } from "@/components/timetable/register-list";
import { SessionActions } from "@/components/timetable/session-actions";
import { requireApproved } from "@/lib/auth/session";
import { campusDay, formatCampus, formatCampusRange } from "@/lib/campus-time";
import { moduleLabel, sessionState, weekStartOf } from "@/lib/timetable";
import {
  canTakeRegister,
  getRegister,
  getSession,
  managesBatch,
  myPresence,
} from "@/server/queries/timetable";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getSession(id);
}

export async function generateMetadata({
  params,
}: PageProps<"/timetable/sessions/[id]">): Promise<Metadata> {
  await requireApproved();
  const session = await load((await params).id);
  return { title: session?.moduleName ?? "Class" };
}

/** One class (Phase D): details, changes, the student's own mark or the staff register. */
export default async function Page({ params }: PageProps<"/timetable/sessions/[id]">) {
  const user = await requireApproved();
  const session = await load((await params).id);
  if (!session) notFound();

  const now = new Date();
  const state = sessionState(session, now);
  const isStudent = user.role === "student" && user.batchId === session.batchId;
  const [register, manages, present] = await Promise.all([
    canTakeRegister(session.id),
    managesBatch(session.batchId),
    isStudent ? myPresence(user.id, [session.id]) : Promise.resolve(new Set<string>()),
  ]);
  const roster = register ? await getRegister(session) : null;
  const isPresent = present.has(session.id);
  const week = weekStartOf(campusDay(session.startsAt));
  const presentCount = roster?.rows.filter((r) => r.present).length ?? 0;

  return (
    <>
      <PageHeader
        title={session.moduleName}
        description={`${session.batchName} · ${formatCampusRange(session.startsAt, session.endsAt)}`}
        breadcrumbs={[
          { label: "Timetable", href: `/timetable?week=${week}` },
          { label: moduleLabel(session.moduleName, session.moduleCode) },
        ]}
        badge={
          state === "cancelled" ? (
            <CategoryChip tint="red">Cancelled</CategoryChip>
          ) : state === "live" ? (
            <CategoryChip tint="blue">On now</CategoryChip>
          ) : state === "ended" ? (
            <CategoryChip tint="zinc">Ended</CategoryChip>
          ) : undefined
        }
        actions={
          manages ? (
            <SessionActions
              sessionId={session.id}
              moduleName={session.moduleName}
              state={state}
              startsAt={session.startsAt}
              endsAt={session.endsAt}
              room={session.room}
            />
          ) : undefined
        }
      />

      {state === "cancelled" && (
        <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-bold">This class is cancelled.</p>
          {session.changeReason && <p className="mt-0.5">{session.changeReason}</p>}
        </div>
      )}
      {state !== "cancelled" && session.movedFrom && (
        <div className="mb-5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-bold">Moved from {formatCampus(session.movedFrom, "dayTime")}.</p>
          {session.changeReason && <p className="mt-0.5">{session.changeReason}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="lg:order-2" aria-label="Class details">
          <div className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft">
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3">
                <dt className="sr-only">When</dt>
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd className="font-bold">{formatCampusRange(session.startsAt, session.endsAt)}</dd>
              </div>
              {session.room && (
                <div className="flex gap-3">
                  <dt className="sr-only">Room</dt>
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <dd className="font-bold">{session.room}</dd>
                </div>
              )}
              {session.lecturer && (
                <div className="flex gap-3">
                  <dt className="sr-only">Lecturer</dt>
                  <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <dd>
                    <Link
                      href={`/u/${session.lecturer.username}`}
                      className="font-bold hover:text-primary"
                    >
                      {session.lecturer.name}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {isStudent && state !== "cancelled" && (
              <div className="border-t pt-4">
                {isPresent ? (
                  <p className="text-sm font-bold text-success">You&apos;re marked present.</p>
                ) : state === "live" ? (
                  <MarkPresentButton sessionId={session.id} moduleName={session.moduleName} />
                ) : state === "upcoming" ? (
                  <p className="text-[13px] text-muted-foreground">
                    You can mark yourself present from {formatCampus(session.startsAt, "time")}{" "}
                    until {formatCampus(session.endsAt, "time")}, while the class is on.
                  </p>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    You weren&apos;t marked present. If you were there, ask your lecturer to correct
                    the register.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:order-1">
          {roster ? (
            <>
              <section
                aria-labelledby="register"
                className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="register" className="flex items-center gap-2 text-[15px] font-extrabold">
                    <Users className="size-4.5 text-primary" aria-hidden /> Register
                  </h2>
                  {state !== "upcoming" && state !== "cancelled" && (
                    <p className="text-sm font-bold text-muted-foreground">
                      {presentCount} of {roster.rows.length} present
                    </p>
                  )}
                </div>
                {state === "upcoming" && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Students mark themselves present while the class is on. You can correct the
                    register once it starts.
                  </p>
                )}
                {roster.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students in this batch yet.</p>
                ) : (
                  <RegisterList
                    sessionId={session.id}
                    rows={roster.rows}
                    editable={state === "live" || state === "ended"}
                  />
                )}
              </section>

              <section
                aria-labelledby="corrections"
                className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
              >
                <h2
                  id="corrections"
                  className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"
                >
                  <History className="size-4.5 text-primary" aria-hidden /> Corrections
                </h2>
                {roster.changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No corrections.</p>
                ) : (
                  <ul className="space-y-3">
                    {roster.changes.map((c) => (
                      <li key={c.id} className="text-sm">
                        <p>
                          <span className="font-bold">{c.studentName}</span> marked{" "}
                          {c.present ? "present" : "absent"} by {c.changedBy} ·{" "}
                          <span className="text-muted-foreground">
                            {formatCampus(c.changedAt, "dayTime")}
                          </span>
                        </p>
                        <p className="text-muted-foreground">{c.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-[22px] border bg-card p-5 text-sm shadow-soft sm:p-7">
              <p className="text-muted-foreground">
                {isStudent
                  ? "Your attendance for every module is on the Attendance page."
                  : "The register is visible to the class's lecturer and the department's coordinator."}
              </p>
              {isStudent && (
                <Link
                  href="/attendance"
                  className="mt-2 inline-flex min-h-10 items-center font-bold text-primary hover:underline dark:text-accent-foreground"
                >
                  My attendance
                </Link>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
