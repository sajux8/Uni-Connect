import { Clock, MapPin, Users, Video } from "lucide-react";
import Link from "next/link";

import { RegisterButton } from "@/components/events/register-button";
import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import { formatCampus, formatCampusRange } from "@/lib/campus-time";
import {
  AVAILABILITY_LABELS,
  eventAvailability,
  eventCategoryInfo,
  type Availability,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventSummary, MyRegistration } from "@/server/queries/events";

/** "OCT / 14" date tile. Server-safe. */
export function EventDateBlock({ startsAt, className }: { startsAt: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid w-14 shrink-0 place-items-center self-start rounded-2xl bg-accent py-2 text-center text-accent-foreground",
        className,
      )}
      aria-hidden
    >
      <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase">
        {formatCampus(startsAt, "monthShort")}
      </span>
      <span className="text-[22px] leading-none font-extrabold">
        {formatCampus(startsAt, "dayNumber")}
      </span>
    </span>
  );
}

/** "42 / 60" seats with a bar; unlimited events just say how many are going. */
export function CapacityBar({
  registered,
  capacity,
  waitlist,
  className,
}: {
  registered: number;
  capacity: number | null;
  waitlist: number;
  className?: string;
}) {
  if (capacity === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] text-muted-foreground",
          className,
        )}
      >
        <Users className="size-3.5" aria-hidden /> {registered} going
      </span>
    );
  }
  const pct = Math.min(100, Math.round((registered / capacity) * 100));
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-[13px] text-muted-foreground", className)}
    >
      <span
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Seats taken"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={registered}
      >
        <span
          className={cn("block h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      {registered}/{capacity}
      {waitlist > 0 && <span>· {waitlist} waiting</span>}
    </span>
  );
}

export function AvailabilityChip({ availability }: { availability: Availability }) {
  const info = AVAILABILITY_LABELS[availability];
  return <CategoryChip tint={info.tint}>{info.label}</CategoryChip>;
}

/** One event in a list. The whole card opens the event; the register button works in place. */
export function EventCard({
  event,
  registration,
  eligible,
  showRegister = true,
}: {
  event: EventSummary;
  registration: MyRegistration | null;
  eligible: boolean;
  showRegister?: boolean;
}) {
  const category = eventCategoryInfo(event.category);
  const availability = eventAvailability(event);
  const online = event.format === "online";

  return (
    <article
      aria-labelledby={`event-${event.id}`}
      className={cn(
        "relative flex gap-4 rounded-[22px] border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift sm:p-5",
        availability === "cancelled" && "opacity-75",
      )}
    >
      <EventDateBlock startsAt={event.startsAt} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip tint={category.tint}>{category.label}</CategoryChip>
          {event.official && <OfficialBadge />}
          {event.place && (
            <span className="text-xs font-semibold text-muted-foreground">{event.place.name}</span>
          )}
          {availability !== "open" && <AvailabilityChip availability={availability} />}
        </div>
        <h3 id={`event-${event.id}`} className="text-[17px] leading-snug font-extrabold">
          <Link
            href={`/events/${event.id}`}
            className={cn(
              "outline-none after:absolute after:inset-0 after:rounded-[22px] hover:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring/40",
              availability === "cancelled" && "line-through decoration-2",
            )}
          >
            {event.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            {formatCampusRange(event.startsAt, event.endsAt)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {online ? (
              <Video className="size-3.5" aria-hidden />
            ) : (
              <MapPin className="size-3.5" aria-hidden />
            )}
            <span className="truncate">{online ? "Online" : event.venue}</span>
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CapacityBar
            registered={event.registeredCount}
            capacity={event.capacity}
            waitlist={event.waitlistCount}
          />
          {showRegister && (
            <div className="relative z-10">
              <RegisterButton
                eventId={event.id}
                eventTitle={event.title}
                availability={availability}
                registration={registration}
                eligible={eligible}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
