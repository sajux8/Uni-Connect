import { CalendarDays, CalendarPlus, List, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventCalendar } from "@/components/events/event-calendar";
import { EventCard } from "@/components/events/event-card";
import { FilterSelect } from "@/components/shared/filter-select";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/forms/field";
import { requireApproved } from "@/lib/auth/session";
import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { EVENT_CATEGORIES, eventAvailability, isEligible, parseEventCategory } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { parseEventWhen, type EventWhen } from "@/lib/validation/events";
import {
  listEvents,
  listEventsInMonth,
  myRegistrations,
  type EventSummary,
  listEventsToReview,
} from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events"].title };

const WHEN_LABELS: Record<EventWhen, string> = {
  upcoming: "Upcoming",
  week: "Next 7 days",
  month: "Next 30 days",
  past: "Past",
};

function dayHeading(day: string, today: string, tomorrow: string) {
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  return formatCampus(`${day}T12:00:00+05:30`, "dayLong");
}

export default async function Page({ searchParams }: PageProps<"/events">) {
  const user = await requireApproved();
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";
  const when = parseEventWhen(params.when);
  const category = parseEventCategory(params.category);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const eligibleOnly = params.eligible === "1";
  const seatsOnly = params.seats === "1";
  const month =
    typeof params.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.m)
      ? params.m
      : campusDay(new Date()).slice(0, 7);
  const current = {
    view: view === "calendar" ? "calendar" : undefined,
    when: when === "upcoming" ? undefined : when,
    category,
    q: q || undefined,
    eligible: eligibleOnly ? "1" : undefined,
    seats: seatsOnly ? "1" : undefined,
    m: view === "calendar" && typeof params.m === "string" ? month : undefined,
  };
  // Anyone can propose an event; club, batch and department events go for approval (Phase C).
  const canPublish = true;
  const toReview = (await listEventsToReview(user.id)).length;
  const viewer = { departmentId: user.departmentId, yearOfStudy: user.yearOfStudy };

  const [events, registrations] = await Promise.all([
    view === "calendar"
      ? listEventsInMonth(month)
      : listEvents({ when, category, q: q || undefined }),
    myRegistrations(user.id),
  ]);
  const shown = events.filter((e) => {
    if (view === "calendar" && category && e.category !== category) return false;
    if (eligibleOnly && !isEligible(e, viewer)) return false;
    if (seatsOnly && !["open", "few"].includes(eventAvailability(e))) return false;
    return true;
  });

  const today = campusDay(new Date());
  const tomorrow = addCampusDays(today, 1);
  const groups = new Map<string, EventSummary[]>();
  for (const e of shown) {
    const key = campusDay(e.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const filtered = Boolean(category || q || eligibleOnly || seatsOnly || when !== "upcoming");

  return (
    <>
      <PageHeader
        title="What's on"
        description="Talks, workshops, fairs and socials across campus. Register in one tap."
        actions={
          <>
            {toReview > 0 && (
              <Link href="/events/review" className={buttonVariants({ variant: "outline" })}>
                To review
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {toReview}
                </span>
              </Link>
            )}
            <Link href="/events/mine" className={buttonVariants({ variant: "outline" })}>
              My events
            </Link>
            {canPublish && (
              <Link href="/events/new" className={buttonVariants()}>
                <CalendarPlus data-icon="inline-start" /> New event
              </Link>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {view === "list" ? (
              <FilterTabs
                label="When"
                items={(Object.keys(WHEN_LABELS) as EventWhen[]).map((w) => ({
                  href: withParams("/events", current, { when: w === "upcoming" ? undefined : w }),
                  label: WHEN_LABELS[w],
                  active: when === w,
                }))}
              />
            ) : (
              <span />
            )}
            <div
              className="inline-flex rounded-full border bg-card p-0.5"
              role="group"
              aria-label="View"
            >
              {(["list", "calendar"] as const).map((v) => (
                <Link
                  key={v}
                  href={withParams("/events", current, { view: v === "list" ? undefined : v })}
                  aria-current={view === v ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-colors",
                    view === v
                      ? "bg-accent text-primary dark:text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "list" ? (
                    <List className="size-4" aria-hidden />
                  ) : (
                    <CalendarDays className="size-4" aria-hidden />
                  )}
                  {v === "list" ? "List" : "Calendar"}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === "list" && (
              <form action="/events" className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-64">
                {Object.entries(current).map(
                  ([k, v]) => v && k !== "q" && <input key={k} type="hidden" name={k} value={v} />,
                )}
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <label htmlFor="event-search" className="sr-only">
                  Search events
                </label>
                <input
                  id="event-search"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Search events"
                  className={cn(inputClass, "h-10 rounded-full pl-10")}
                />
              </form>
            )}
            <FilterSelect
              label="Category"
              options={[
                {
                  href: withParams("/events", current, { category: undefined }),
                  label: "All categories",
                  selected: !category,
                },
                ...EVENT_CATEGORIES.map((c) => ({
                  href: withParams("/events", current, { category: c.value }),
                  label: c.label,
                  selected: category === c.value,
                })),
              ]}
            />
            {[
              { key: "eligible", label: "Eligible for me", on: eligibleOnly },
              { key: "seats", label: "Has seats", on: seatsOnly },
            ].map((t) => (
              <Link
                key={t.key}
                href={withParams("/events", current, { [t.key]: t.on ? undefined : "1" })}
                scroll={false}
                aria-pressed={t.on}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border-[1.5px] px-4 text-sm font-bold transition-colors",
                  t.on
                    ? "border-primary/40 bg-accent text-primary dark:text-accent-foreground"
                    : "border-input text-muted-foreground hover:border-border-strong",
                )}
              >
                {t.on ? "✓ " : ""}
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </PageHeader>

      {view === "calendar" ? (
        <EventCalendar
          month={month}
          events={shown}
          registeredIds={new Set(registrations.keys())}
          hrefForMonth={(m) => withParams("/events", current, { m })}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtered ? "No events match" : "Nothing scheduled yet"}
          description={
            filtered
              ? "Try another category or date range, or clear the filters."
              : "When organizers publish events, they'll appear here."
          }
          action={
            filtered ? (
              <Link href="/events" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            ) : canPublish ? (
              <Link href="/events/new" className={buttonVariants({ variant: "outline" })}>
                Create an event
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="max-w-3xl space-y-7">
          {[...groups.entries()].map(([day, dayEvents]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="mb-3 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase"
              >
                {dayHeading(day, today, tomorrow)}
              </h2>
              <div className="space-y-3">
                {dayEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    registration={registrations.get(e.id) ?? null}
                    eligible={isEligible(e, viewer)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
