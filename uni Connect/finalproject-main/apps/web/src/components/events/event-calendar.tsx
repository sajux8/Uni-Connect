import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { eventCategoryInfo } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventSummary } from "@/server/queries/events";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "2026-10" → the 6×7 grid of campus days shown for that month (weeks start on Monday). */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  // Day of week for the 1st (0 = Monday) at campus noon, so no time-zone edge.
  const weekday = (new Date(`${first}T12:00:00+05:30`).getUTCDay() + 6) % 7;
  const start = addCampusDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addCampusDays(start, i));
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Month view (Feature 6): a grid on tablets and up, an agenda of the month's days on phones,
 * where a 7-column grid would be too cramped to read or tap. Server-safe; months are links.
 */
export function EventCalendar({
  month,
  events,
  hrefForMonth,
  registeredIds,
}: {
  month: string;
  events: EventSummary[];
  hrefForMonth: (month: string) => string;
  registeredIds: Set<string>;
}) {
  const days = monthGrid(month);
  const today = campusDay(new Date());
  const byDay = new Map<string, EventSummary[]>();
  for (const e of events) {
    const key = campusDay(e.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const label = formatCampus(`${month}-15T12:00:00+05:30`, "monthYear");
  const daysWithEvents = [...byDay.keys()].sort();

  return (
    <section aria-label={`Events in ${label}`} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{label}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={hrefForMonth(shiftMonth(month, -1))}
            scroll={false}
            className={buttonVariants({ variant: "outline", size: "icon" })}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Link>
          <Link
            href={hrefForMonth(campusDay(new Date()).slice(0, 7))}
            scroll={false}
            className={buttonVariants({ variant: "outline" })}
          >
            Today
          </Link>
          <Link
            href={hrefForMonth(shiftMonth(month, 1))}
            scroll={false}
            className={buttonVariants({ variant: "outline", size: "icon" })}
            aria-label="Next month"
          >
            <ChevronRight />
          </Link>
        </div>
      </div>

      {/* Grid: tablets and up */}
      <div className="hidden overflow-hidden rounded-[22px] border bg-card shadow-soft sm:block">
        <div className="grid grid-cols-7 border-b bg-surface-tint text-center text-xs font-bold text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.startsWith(month);
            const dayEvents = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-surface-tint/60 text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs font-bold",
                    day === today && "bg-primary text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {dayEvents.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    title={`${formatCampus(e.startsAt, "time")} ${e.title}`}
                    className={cn(
                      "tint block truncate rounded-md px-1.5 py-1 text-[11.5px] leading-tight font-semibold hover:brightness-95",
                      `tint-${eventCategoryInfo(e.category).tint}`,
                      e.status === "cancelled" && "line-through opacity-60",
                      registeredIds.has(e.id) && "ring-2 ring-primary/50",
                    )}
                  >
                    {formatCampus(e.startsAt, "time")} {e.title}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1.5 text-[11px] font-semibold text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda: phones */}
      <div className="space-y-3 sm:hidden">
        {daysWithEvents.length === 0 ? (
          <p className="rounded-[22px] border bg-card p-5 text-center text-sm text-muted-foreground">
            No events in {label}.
          </p>
        ) : (
          daysWithEvents.map((day) => (
            <div key={day} className="rounded-[22px] border bg-card p-3 shadow-soft">
              <h3
                className={cn(
                  "mb-1 px-1 text-xs font-extrabold tracking-[0.12em] uppercase",
                  day === today ? "text-primary" : "text-muted-foreground",
                )}
              >
                {day === today ? "Today · " : ""}
                {formatCampus(`${day}T12:00:00+05:30`, "day")}
              </h3>
              <ul>
                {byDay.get(day)!.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/events/${e.id}`}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-accent/60"
                    >
                      <span
                        className={cn(
                          "tint h-8 w-1 shrink-0 rounded-full",
                          `tint-${eventCategoryInfo(e.category).tint}`,
                        )}
                        aria-hidden
                      />
                      <span className="w-11 shrink-0 text-sm font-bold tabular-nums">
                        {formatCampus(e.startsAt, "time")}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-semibold",
                          e.status === "cancelled" && "line-through opacity-60",
                        )}
                      >
                        {e.title}
                      </span>
                      {registeredIds.has(e.id) && (
                        <span className="text-xs font-bold text-success">Going</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
