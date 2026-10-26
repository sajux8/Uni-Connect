/**
 * Timetables and attendance: week maths in campus time, the state of a
 * class, and attendance rates. Pure functions, shared by the server pages and the browser.
 */

import { addCampusDays, campusDay, CAMPUS_UTC_OFFSET } from "@/lib/campus-time";

export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

/** Missed classes in a row that alert the coordinator (mirrors `check_attendance_streaks`). */
export const ALERT_STREAK = 3;

/** ISO weekday (1 = Monday … 7 = Sunday) of a campus calendar day "2026-10-14". */
export function campusWeekday(day: string): number {
  const d = new Date(`${day}T12:00:00${CAMPUS_UTC_OFFSET}`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The Monday of the campus week containing `day`. */
export function weekStartOf(day: string): string {
  return addCampusDays(day, 1 - campusWeekday(day));
}

/** The week a `?week=` value points at (any day in it), or this week. */
export function parseWeek(value: unknown, now: Date = new Date()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00${CAMPUS_UTC_OFFSET}`);
    if (!Number.isNaN(date.getTime()) && campusDay(date) === value) return weekStartOf(value);
  }
  return weekStartOf(campusDay(now));
}

/** The seven campus days of the week starting `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addCampusDays(monday, i));
}

export type SessionStatus = "scheduled" | "cancelled";
export type SessionState = "cancelled" | "upcoming" | "live" | "ended";

/** Where a class is now. Students can only mark themselves present while it's "live". */
export function sessionState(
  session: { status: SessionStatus; startsAt: string; endsAt: string },
  now: Date = new Date(),
): SessionState {
  if (session.status === "cancelled") return "cancelled";
  const t = now.getTime();
  if (t < new Date(session.startsAt).getTime()) return "upcoming";
  if (t > new Date(session.endsAt).getTime()) return "ended";
  return "live";
}

/** "09:00:00" (a Postgres time) → "09:00". */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** "CS201 · Databases", or just the name. */
export function moduleLabel(name: string, code?: string | null): string {
  return code ? `${code} · ${name}` : name;
}

export interface AttendanceRate {
  held: number;
  attended: number;
  /** Whole percent, or null before any class has been held. */
  percent: number | null;
}

export function rate(attended: number, held: number): AttendanceRate {
  return { held, attended, percent: held > 0 ? Math.round((attended / held) * 100) : null };
}

/** Green from 80%, amber from 60%, red below (no colour before any class). */
export function rateTone(percent: number | null): "good" | "warning" | "bad" | "none" {
  if (percent === null) return "none";
  if (percent >= 80) return "good";
  return percent >= 60 ? "warning" : "bad";
}

export interface AttendanceRecord {
  moduleCode: string | null;
  moduleName: string;
  startsAt: string;
  present: boolean;
}

/** Overall and per-module rates, modules sorted by name. */
export function attendanceSummary(records: AttendanceRecord[]): {
  overall: AttendanceRate;
  modules: (AttendanceRate & { name: string; code: string | null })[];
} {
  const byModule = new Map<
    string,
    { name: string; code: string | null; held: number; attended: number }
  >();
  for (const r of records) {
    const key = r.moduleCode ?? r.moduleName.toLowerCase();
    const m = byModule.get(key) ?? { name: r.moduleName, code: r.moduleCode, held: 0, attended: 0 };
    m.held++;
    if (r.present) m.attended++;
    byModule.set(key, m);
  }
  return {
    overall: rate(records.filter((r) => r.present).length, records.length),
    modules: [...byModule.values()]
      .map((m) => ({ name: m.name, code: m.code, ...rate(m.attended, m.held) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Classes missed since the last one attended (records in any order). */
export function currentStreak(records: { startsAt: string; present: boolean }[]): number {
  const sorted = [...records].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const lastPresent = sorted.findIndex((r) => r.present);
  return lastPresent === -1 ? sorted.length : lastPresent;
}
