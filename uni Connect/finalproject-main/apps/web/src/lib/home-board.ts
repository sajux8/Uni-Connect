import { addCampusDays, campusDay, formatCampus } from "@/lib/campus-time";
import { sessionState, type SessionState, type SessionStatus } from "@/lib/timetable";

/**
 * Home's board: classes, registered events and feedback to give in one
 * list in time order. What is still ahead goes on the board, grouped by day; today's finished
 * classes go under "Earlier". Pure, so the server and the tests share it.
 */

export interface BoardSession {
  id: string;
  moduleName: string;
  moduleCode: string | null;
  batchName: string;
  lecturer: { name: string } | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  changeReason: string | null;
  movedFrom: string | null;
}

export interface BoardEvent {
  id: string;
  title: string;
  organizingUnit: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  official: boolean;
}

export interface BoardForm {
  id: string;
  title: string;
  closesAt: string | null;
}

export type BoardRow =
  | {
      kind: "class";
      key: string;
      at: string;
      session: BoardSession;
      state: SessionState;
      present: boolean;
      next: boolean;
    }
  | { kind: "event"; key: string; at: string; event: BoardEvent; live: boolean; next: boolean }
  | { kind: "feedback"; key: string; at: string | null; form: BoardForm; next: false };

export interface BoardGroup {
  /** Campus day ("2026-10-12"), or null for feedback forms with no closing date. */
  day: string | null;
  label: string;
  rows: BoardRow[];
}

/**
 * The classes Home shows: all of today's, plus the next day that has classes when nothing is left
 * today (so Sunday evening shows Monday). `sessions` is in start order.
 */
export function pickHomeSessions<T extends BoardSession>(sessions: T[], now: Date): T[] {
  const today = campusDay(now);
  const todays = sessions.filter((s) => campusDay(s.startsAt) === today);
  const anyLeft = todays.some((s) => {
    const state = sessionState(s, now);
    return state === "live" || state === "upcoming";
  });
  if (anyLeft) return todays;
  const nextDay = sessions.map((s) => campusDay(s.startsAt)).find((day) => day > today);
  return nextDay
    ? [...todays, ...sessions.filter((s) => campusDay(s.startsAt) === nextDay)]
    : todays;
}

/** "Today", "Tomorrow · Monday 12 October" or "Friday 16 October". */
export function boardDayLabel(day: string, today: string): string {
  const long = formatCampus(`${day}T12:00:00+05:30`, "dayLong");
  if (day === today) return "Today";
  if (day === addCampusDays(today, 1)) return `Tomorrow · ${long}`;
  return long;
}

/**
 * The next moment the board changes by itself: a class or event starting or ending. Home's clock
 * reloads the page then. Null when nothing is scheduled.
 */
export function nextBoardChange(
  items: { startsAt: string; endsAt: string }[],
  now: Date,
): string | null {
  const t = now.getTime();
  const times = items
    .flatMap((item) => [new Date(item.startsAt).getTime(), new Date(item.endsAt).getTime()])
    .filter((time) => time > t);
  return times.length > 0 ? new Date(Math.min(...times)).toISOString() : null;
}

export function buildBoard(input: {
  sessions: BoardSession[];
  present: ReadonlySet<string> | string[];
  events: BoardEvent[];
  forms: BoardForm[];
  now: Date;
}): { groups: BoardGroup[]; earlier: Extract<BoardRow, { kind: "class" }>[] } {
  const { now } = input;
  const today = campusDay(now);
  const present = new Set(input.present);
  const ahead: BoardRow[] = [];
  const earlier: Extract<BoardRow, { kind: "class" }>[] = [];

  for (const session of input.sessions) {
    const state = sessionState(session, now);
    const over = new Date(session.endsAt).getTime() < now.getTime();
    const row = {
      kind: "class" as const,
      key: `class-${session.id}`,
      at: session.startsAt,
      session,
      state,
      present: present.has(session.id),
      next: false,
    };
    // A cancelled class stays on the board until its time has passed.
    if (state === "ended" || (state === "cancelled" && over)) earlier.push(row);
    else ahead.push(row);
  }
  for (const event of input.events) {
    const t = now.getTime();
    ahead.push({
      kind: "event",
      key: `event-${event.id}`,
      at: event.startsAt,
      event,
      live: new Date(event.startsAt).getTime() <= t && t <= new Date(event.endsAt).getTime(),
      next: false,
    });
  }
  for (const form of input.forms) {
    ahead.push({ kind: "feedback", key: `form-${form.id}`, at: form.closesAt, form, next: false });
  }

  const time = (row: BoardRow) => (row.at ? new Date(row.at).getTime() : Number.POSITIVE_INFINITY);
  ahead.sort((a, b) => time(a) - time(b));
  earlier.sort((a, b) => time(b) - time(a));

  // "Next" marks the first class or event that hasn't started (a live one is already "Now").
  const next = ahead.find(
    (row) =>
      (row.kind === "class" && row.state === "upcoming") || (row.kind === "event" && !row.live),
  );
  if (next && next.kind !== "feedback" && new Date(next.at).getTime() > now.getTime()) {
    next.next = true;
  }

  const groups: BoardGroup[] = [];
  for (const row of ahead) {
    // Something already running (an event that started yesterday) belongs to today.
    const rawDay = row.at ? campusDay(row.at) : null;
    const day = rawDay && rawDay < today ? today : rawDay;
    let group = groups.find((g) => g.day === day);
    if (!group) {
      group = { day, label: day ? boardDayLabel(day, today) : "No closing date", rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return { groups, earlier };
}
