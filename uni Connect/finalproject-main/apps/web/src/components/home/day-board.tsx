import { CalendarClock, CalendarDays, ClipboardList, GraduationCap, MapPin } from "lucide-react";
import Link from "next/link";

import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import { MarkPresentButton } from "@/components/timetable/mark-present-button";
import { formatCampus } from "@/lib/campus-time";
import type { BoardGroup, BoardRow } from "@/lib/home-board";
import { cn } from "@/lib/utils";

/**
 * Home's "Coming up" board: classes, events the member registered for and feedback to give, one
 * row each, in time order under a label per day. The columns (time, what, where, status) line up
 * from row to row without a header (the rows explain themselves); on a narrow board the place and
 * status move under the title. Server-safe.
 */

/** The three cells after the time column: what, where and status. */
const CELLS =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 @lg:grid-cols-[minmax(0,1fr)_auto] @[44rem]:grid-cols-[minmax(0,1fr)_9.5rem_9.75rem]";
const ROW =
  "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4 px-5 @[44rem]:grid-cols-[5rem_minmax(0,1fr)]";

const linkClass =
  "inline-flex min-h-10 items-center text-sm font-bold text-primary hover:underline dark:text-accent-foreground";

export function DayBoard({
  groups,
  student,
  eventsLink,
  formsLink,
}: {
  groups: BoardGroup[];
  student: boolean;
  eventsLink: { href: string; label: string };
  formsLink?: { href: string; label: string };
}) {
  return (
    <section
      aria-labelledby="coming-up"
      className="@container overflow-hidden rounded-[22px] border bg-card shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
        <h2 id="coming-up" className="flex items-center gap-2 text-[17px] font-extrabold">
          <CalendarClock className="size-4.5 text-primary" aria-hidden /> Coming up
        </h2>
        <Link href="/timetable" className={linkClass}>
          Full timetable
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="max-w-prose px-5 pt-1 pb-5 text-sm text-pretty text-muted-foreground">
          Nothing is coming up. Your classes, the events you register for and feedback forms to
          answer will appear here in time order.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.day ?? "anytime"}>
            <h3 className="border-y bg-surface-tint px-5 py-1.5 text-[13px] font-extrabold">
              {group.label}
            </h3>
            <ol className="divide-y">
              {group.rows.map((row) => (
                <BoardItem key={row.key} row={row} student={student} />
              ))}
            </ol>
          </div>
        ))
      )}

      <div className="flex flex-wrap gap-x-6 border-t px-5">
        <Link href={eventsLink.href} className={linkClass}>
          {eventsLink.label}
        </Link>
        {formsLink && (
          <Link href={formsLink.href} className={linkClass}>
            {formsLink.label}
          </Link>
        )}
      </div>
    </section>
  );
}

function BoardItem({ row, student }: { row: BoardRow; student: boolean }) {
  const view = describe(row, student);
  // On a tinted row the grey secondary text loses contrast, so it is taken from the text colour.
  const quiet = view.tone === "plain" ? "text-muted-foreground" : "text-foreground/75";
  return (
    <li
      className={cn(
        ROW,
        "relative py-3.5 transition-colors",
        view.tone === "plain" && "hover:bg-surface-tint",
        view.tone === "live" && "bg-accent",
        view.tone === "cancelled" && "bg-destructive/5",
        view.tone === "moved" && "bg-warning/10",
      )}
    >
      <p className="leading-tight tabular-nums">
        <span className="block text-[15px] font-extrabold">{view.time}</span>
        {view.timeNote && (
          <span className={cn("block text-xs font-semibold", quiet)}>{view.timeNote}</span>
        )}
      </p>

      <div className={CELLS}>
        <div
          className={cn(
            "col-span-2 flex min-w-0 gap-3 @lg:col-span-1",
            !view.place && "@[44rem]:col-span-2",
          )}
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              view.tileClass,
              // On the tinted live row the blue tile would vanish.
              view.tone === "live" && "bg-card",
            )}
          >
            <view.icon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <Link
              href={view.href}
              className={cn(
                "block text-[15px] leading-snug font-extrabold text-pretty outline-none after:absolute after:inset-0 hover:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset dark:hover:text-accent-foreground",
                view.struck && "text-muted-foreground line-through",
              )}
            >
              {view.title}
            </Link>
            <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]", quiet)}>
              {view.detail}
              {view.official && <OfficialBadge />}
            </p>
            {view.note && (
              <p className={cn("mt-1 text-[13px] font-semibold", view.noteClass)}>{view.note}</p>
            )}
          </div>
        </div>

        {view.place && (
          <p
            className={cn(
              "col-start-1 flex min-w-0 items-center gap-1.5 self-center pl-12 text-[13px] @lg:row-start-2 @[44rem]:col-start-2 @[44rem]:row-start-1 @[44rem]:pl-0",
              quiet,
            )}
          >
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 @[44rem]:truncate">{view.place}</span>
          </p>
        )}

        {view.status && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-end gap-1.5 self-center @lg:col-span-1 @lg:col-start-2 @lg:row-start-1 @[44rem]:col-start-3",
              view.place ? "@lg:row-span-2 @[44rem]:row-span-1" : "col-span-2",
              // The Mark present button gets a line of its own on a phone.
              view.action && "col-span-2 pl-12 @lg:pl-0",
            )}
          >
            {view.status}
          </div>
        )}
      </div>
    </li>
  );
}

/** Today's classes that are over, under "Earlier": time, module and how attendance turned out. */
export function EarlierClasses({
  rows,
  student,
}: {
  rows: Extract<BoardRow, { kind: "class" }>[];
  student: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <ul
      aria-label="Classes earlier today"
      className="divide-y overflow-hidden rounded-[22px] border bg-card shadow-soft"
    >
      {rows.map(({ session: s, state, present }) => (
        <li
          key={s.id}
          className="relative grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 transition-colors hover:bg-surface-tint"
        >
          <p className="text-[13px] leading-tight font-bold text-muted-foreground tabular-nums">
            {formatCampus(s.startsAt, "time")}
            <span className="block text-xs font-semibold">to {formatCampus(s.endsAt, "time")}</span>
          </p>
          <div className="min-w-0">
            <Link
              href={`/timetable/sessions/${s.id}`}
              className={cn(
                "block truncate text-sm font-bold outline-none after:absolute after:inset-0 hover:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset dark:hover:text-accent-foreground",
                state === "cancelled" && "text-muted-foreground line-through",
              )}
            >
              {s.moduleName}
            </Link>
            <p className="truncate text-[13px] text-muted-foreground">
              {["Class", student ? s.room : s.batchName].filter(Boolean).join(" · ")}
            </p>
          </div>
          {state === "cancelled" ? (
            <CategoryChip tint="red">Cancelled</CategoryChip>
          ) : student ? (
            present ? (
              <CategoryChip tint="emerald">Present</CategoryChip>
            ) : (
              <CategoryChip tint="red">Absent</CategoryChip>
            )
          ) : (
            <CategoryChip>Ended</CategoryChip>
          )}
        </li>
      ))}
    </ul>
  );
}

function NowChip() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-bold text-primary-foreground dark:bg-accent-foreground dark:text-background">
      <span
        className="size-1.5 animate-pulse rounded-full bg-brand-cyan dark:bg-primary"
        aria-hidden
      />{" "}
      Now
    </span>
  );
}

function NextChip() {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-primary/30 px-2.5 text-xs font-bold text-primary dark:text-accent-foreground">
      Next
    </span>
  );
}

function describe(row: BoardRow, student: boolean) {
  if (row.kind === "class") {
    const s = row.session;
    const cancelled = row.state === "cancelled";
    const who = student ? s.lecturer?.name : s.batchName;
    const canMark = row.state === "live" && student && !row.present;
    return {
      action: canMark,
      icon: GraduationCap,
      tileClass: "bg-accent text-accent-foreground",
      href: `/timetable/sessions/${s.id}`,
      title: s.moduleName,
      struck: cancelled,
      time: formatCampus(s.startsAt, "time"),
      timeNote: `to ${formatCampus(s.endsAt, "time")}`,
      detail: ["Class", s.moduleCode, who].filter(Boolean).join(" · "),
      official: false,
      place: s.room,
      note: cancelled
        ? (s.changeReason ?? null)
        : s.movedFrom
          ? `Moved from ${formatCampus(s.movedFrom, "dayTime")}${s.changeReason ? `. ${s.changeReason}` : ""}`
          : null,
      noteClass: "text-foreground",
      tone: cancelled
        ? "cancelled"
        : row.state === "live"
          ? "live"
          : s.movedFrom
            ? "moved"
            : "plain",
      status: cancelled ? (
        <CategoryChip tint="red">Cancelled</CategoryChip>
      ) : canMark ? (
        <>
          <NowChip />
          <MarkPresentButton
            sessionId={s.id}
            moduleName={s.moduleName}
            className="relative z-10 w-auto flex-1 @lg:flex-none"
          />
        </>
      ) : row.state === "live" ? (
        <>
          <NowChip />
          {student && <CategoryChip tint="emerald">Present</CategoryChip>}
        </>
      ) : row.next || s.movedFrom ? (
        <>
          {row.next && <NextChip />}
          {s.movedFrom && <CategoryChip tint="amber">Moved</CategoryChip>}
        </>
      ) : null,
    } as const;
  }

  if (row.kind === "event") {
    const e = row.event;
    return {
      action: false,
      icon: CalendarDays,
      tileClass: "tint tint-teal",
      href: `/events/${e.id}`,
      title: e.title,
      struck: false,
      time: formatCampus(e.startsAt, "time"),
      timeNote: `to ${formatCampus(e.endsAt, "time")}`,
      detail: `Event · ${e.organizingUnit}`,
      official: e.official,
      place: e.venue ?? "Online",
      note: null,
      noteClass: "",
      tone: row.live ? "live" : "plain",
      status: (
        <>
          {row.live ? <NowChip /> : row.next ? <NextChip /> : null}
          <CategoryChip tint="emerald">Registered</CategoryChip>
        </>
      ),
    } as const;
  }

  const f = row.form;
  return {
    action: false,
    icon: ClipboardList,
    tileClass: "tint tint-amber",
    href: `/forms/${f.id}`,
    title: f.title,
    struck: false,
    time: f.closesAt ? formatCampus(f.closesAt, "time") : "Any time",
    timeNote: f.closesAt ? "closes" : null,
    detail: "Feedback form · Anonymous",
    official: false,
    place: null,
    note: null,
    noteClass: "",
    tone: "plain",
    status: <CategoryChip tint="amber">To answer</CategoryChip>,
  } as const;
}
