import type { CategoryTint } from "@/components/shared/badges";
import type { Enums } from "@/types/database";

export type EventCategory = Enums<"event_category">;
export type EventFormat = Enums<"event_format">;
export type EventStatus = Enums<"event_status">;
export type RegistrationStatus = Enums<"registration_status">;

export const EVENT_CATEGORIES: { value: EventCategory; label: string; tint: CategoryTint }[] = [
  { value: "academic", label: "Academic", tint: "blue" },
  { value: "career", label: "Career", tint: "emerald" },
  { value: "workshop", label: "Workshop", tint: "indigo" },
  { value: "social", label: "Social", tint: "pink" },
  { value: "cultural", label: "Cultural", tint: "violet" },
  { value: "sports", label: "Sports", tint: "orange" },
  { value: "club", label: "Club", tint: "teal" },
  { value: "other", label: "Other", tint: "zinc" },
];

export function eventCategoryInfo(category: EventCategory) {
  return EVENT_CATEGORIES.find((c) => c.value === category) ?? EVENT_CATEGORIES[7];
}

export function parseEventCategory(value: unknown): EventCategory | undefined {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.value;
}

export const EVENT_FORMATS: { value: EventFormat; label: string }[] = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

export function formatLabel(format: EventFormat): string {
  return EVENT_FORMATS.find((f) => f.value === format)?.label ?? format;
}

/** Who may register. Empty lists mean everyone; otherwise departments AND years must match. */
export function isEligible(
  event: { departmentIds: string[]; years: number[] },
  user: { departmentId: string | null; yearOfStudy: number | null },
): boolean {
  const deptOk =
    event.departmentIds.length === 0 ||
    (user.departmentId !== null && event.departmentIds.includes(user.departmentId));
  const yearOk =
    event.years.length === 0 ||
    (user.yearOfStudy !== null && event.years.includes(user.yearOfStudy));
  return deptOk && yearOk;
}

export type Availability =
  | "draft"
  | "pending"
  | "rejected"
  | "cancelled"
  | "past"
  | "closed"
  | "full"
  | "waitlist"
  | "few"
  | "open";

/** The seat/registration state shown on cards. */
export function eventAvailability(
  e: {
    status: EventStatus;
    startsAt: string;
    endsAt: string;
    registrationDeadline: string | null;
    capacity: number | null;
    registeredCount: number;
    waitlistEnabled: boolean;
  },
  now: Date = new Date(),
): Availability {
  if (e.status === "draft") return "draft";
  if (e.status === "pending_review") return "pending";
  if (e.status === "rejected") return "rejected";
  if (e.status === "cancelled") return "cancelled";
  if (new Date(e.endsAt) <= now) return "past";
  if (now >= new Date(e.registrationDeadline ?? e.startsAt)) return "closed";
  if (e.capacity !== null) {
    const left = e.capacity - e.registeredCount;
    if (left <= 0) return e.waitlistEnabled ? "waitlist" : "full";
    if (left <= Math.max(3, Math.ceil(e.capacity * 0.1))) return "few";
  }
  return "open";
}

export const AVAILABILITY_LABELS: Record<Availability, { label: string; tint: CategoryTint }> = {
  draft: { label: "Draft", tint: "zinc" },
  pending: { label: "Awaiting approval", tint: "amber" },
  rejected: { label: "Not approved", tint: "red" },
  cancelled: { label: "Cancelled", tint: "red" },
  past: { label: "Ended", tint: "zinc" },
  closed: { label: "Registration closed", tint: "zinc" },
  full: { label: "Full", tint: "red" },
  waitlist: { label: "Full · Waitlist open", tint: "amber" },
  few: { label: "Few seats left", tint: "amber" },
  open: { label: "Open", tint: "emerald" },
};

/** Organizing units offered as suggestions. */
export const ORGANIZING_UNIT_SUGGESTIONS = [
  "Student Services",
  "Careers Office",
  "Student Union",
  "Computing Society",
  "Academic Affairs",
  "Library",
  "Sports Club",
];

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

/** 20261014T043000Z */
export function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** A minimal, valid VCALENDAR with one VEVENT. Lines are CRLF-separated and folded at 75 octets. */
export function buildIcs(e: {
  id: string;
  title: string;
  description: string;
  location: string;
  url: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  cancelled: boolean;
}): string {
  const fold = (line: string) => {
    const out: string[] = [];
    let rest = line;
    while (rest.length > 74) {
      out.push(rest.slice(0, 74));
      rest = ` ${rest.slice(74)}`;
    }
    out.push(rest);
    return out.join("\r\n");
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UniConnect//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@uniconnect`,
    `DTSTAMP:${icsDate(e.updatedAt)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(e.description)}`,
    `LOCATION:${icsEscape(e.location)}`,
    `URL:${e.url}`,
    `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** One CSV field, quoted when needed; formula-looking values are neutralised for spreadsheets. */
export function csvField(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
