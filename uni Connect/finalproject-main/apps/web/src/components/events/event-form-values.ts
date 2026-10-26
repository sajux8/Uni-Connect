import type { EventFormValues } from "@/components/events/event-composer";
import { toCampusInput } from "@/lib/campus-time";
import type { EventDetail } from "@/server/queries/events";

/** Form values from an existing event (editing, or "Duplicate" with the dates cleared). */
export function eventFormValues(e: EventDetail, keepDates: boolean): EventFormValues {
  return {
    title: e.title,
    descriptionHtml: e.descriptionHtml,
    category: e.category,
    organizingUnit: e.organizingUnit,
    format: e.format,
    venue: e.venue ?? "",
    locationDetails: e.locationDetails ?? "",
    onlineUrl: e.onlineUrl ?? "",
    startsAt: keepDates ? toCampusInput(e.startsAt, "datetime") : "",
    endsAt: keepDates ? toCampusInput(e.endsAt, "datetime") : "",
    registrationDeadline: keepDates ? toCampusInput(e.registrationDeadline, "datetime") : "",
    capacity: e.capacity === null ? "" : String(e.capacity),
    waitlistEnabled: e.waitlistEnabled,
    departmentIds: e.departmentIds,
    years: e.years,
    eligibilityNote: e.eligibilityNote ?? "",
    coverUrl: e.coverUrl ?? "",
    spaceId: e.spaceId ?? "",
  };
}
