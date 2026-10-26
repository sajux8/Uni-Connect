/**
 * Campus time: Sri Lanka, UTC+05:30 all year (no daylight saving). The server runs in UTC
 * and phones may be set to any zone, so every date the app shows or reads from a form is
 * converted here explicitly, and the server and browser always agree.
 */
export const CAMPUS_TIME_ZONE = "Asia/Colombo";
export const CAMPUS_UTC_OFFSET = "+05:30";

function parts(iso: string | Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: CAMPUS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** ISO → the value a `datetime-local` or `date` input expects, in campus time. */
export function toCampusInput(iso: string | null, kind: "datetime" | "date"): string {
  if (!iso) return "";
  const p = parts(iso);
  const date = `${p.year}-${p.month}-${p.day}`;
  return kind === "date" ? date : `${date}T${p.hour}:${p.minute}`;
}

/** A `datetime-local` value (or a `date`, meaning the end of that day) in campus time → ISO. */
export function fromCampusInput(value: string, kind: "datetime" | "date"): string {
  if (!value) return "";
  const local = kind === "date" ? `${value}T23:59:59` : `${value}:00`;
  const date = new Date(`${local}${CAMPUS_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** "2026-10-14": the campus calendar day of an instant (for grouping by day). */
export function campusDay(iso: string | Date): string {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

const FORMATS = {
  /** 10:00 */
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  /** Tue 14 Oct */
  day: { weekday: "short", day: "numeric", month: "short" },
  /** Tuesday 14 October */
  dayLong: { weekday: "long", day: "numeric", month: "long" },
  /** Tue 14 Oct, 10:00 */
  dayTime: {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
  /** OCT */
  monthShort: { month: "short" },
  /** 14 */
  dayNumber: { day: "numeric" },
  /** October 2026 */
  monthYear: { month: "long", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type CampusFormat = keyof typeof FORMATS;

/** Formats an instant in campus time, the same on the server and in the browser. */
export function formatCampus(iso: string | Date, format: CampusFormat): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    ...FORMATS[format],
  }).format(new Date(iso));
}

/** "Tue 14 Oct, 10:00–16:00", or both dates when it spans days. */
export function formatCampusRange(startIso: string, endIso: string): string {
  if (campusDay(startIso) === campusDay(endIso)) {
    return `${formatCampus(startIso, "dayTime")}–${formatCampus(endIso, "time")}`;
  }
  return `${formatCampus(startIso, "dayTime")} – ${formatCampus(endIso, "dayTime")}`;
}

/** Adds whole days to a campus calendar day ("2026-10-14" + 1 → "2026-10-15"). */
export function addCampusDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00${CAMPUS_UTC_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return campusDay(d);
}

/** The instant a campus calendar day starts. */
export function campusDayStart(day: string): string {
  return new Date(`${day}T00:00:00${CAMPUS_UTC_OFFSET}`).toISOString();
}
