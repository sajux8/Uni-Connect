import "server-only";

import type { SessionProfile } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { addCampusDays, campusDay, campusDayStart } from "@/lib/campus-time";
import { pickHomeSessions } from "@/lib/home-board";
import { createClient } from "@/lib/supabase/server";
import type { SessionStatus } from "@/lib/timetable";

/**
 * Timetables and attendance. Everything is read as the signed-in user,
 * so RLS decides who sees which batch, class and register (migration 0038).
 */

export interface PersonRef {
  id: string;
  name: string;
  username: string;
}

export interface ClassSession {
  id: string;
  batchId: string;
  batchName: string;
  entryId: string | null;
  moduleCode: string | null;
  moduleName: string;
  lecturer: PersonRef | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  changeReason: string | null;
  movedFrom: string | null;
}

const SESSION_COLUMNS =
  "id, batch_id, entry_id, module_code, module_name, room, starts_at, ends_at, status, change_reason, moved_from, lecturer:profiles!class_sessions_lecturer_id_fkey(id, full_name, username), batch:batches!class_sessions_batch_id_fkey(name)";

type SessionRow = {
  id: string;
  batch_id: string;
  entry_id: string | null;
  module_code: string | null;
  module_name: string;
  room: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  change_reason: string | null;
  moved_from: string | null;
  lecturer: { id: string; full_name: string; username: string } | null;
  batch: { name: string } | null;
};

function toSession(r: SessionRow): ClassSession {
  return {
    id: r.id,
    batchId: r.batch_id,
    batchName: r.batch?.name ?? "",
    entryId: r.entry_id,
    moduleCode: r.module_code,
    moduleName: r.module_name,
    lecturer: r.lecturer
      ? { id: r.lecturer.id, name: r.lecturer.full_name, username: r.lecturer.username }
      : null,
    room: r.room,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status === "cancelled" ? "cancelled" : "scheduled",
    changeReason: r.change_reason,
    movedFrom: r.moved_from,
  };
}

export interface TimetableBatch {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

/**
 * The batches whose timetable this person can open: their own (students), the ones they teach
 * (lecturers), their department's (coordinators) or every batch (super admins).
 */
export async function listTimetableBatches(user: SessionProfile): Promise<TimetableBatch[]> {
  const supabase = await createClient();
  let query = supabase
    .from("batches")
    .select("id, name, number, department_id, departments(name)")
    .eq("is_active", true)
    .order("number", { ascending: false });
  if (user.role === "student") {
    if (!user.batchId) return [];
    query = query.eq("id", user.batchId);
  } else if (user.role === "lecturer") {
    const { data: taught } = await supabase
      .from("batch_lecturers")
      .select("batch_id")
      .eq("lecturer_id", user.id);
    const ids = (taught ?? []).map((t) => t.batch_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  } else if (user.role === "coordinator") {
    if (!user.departmentId) return [];
    query = query.eq("department_id", user.departmentId);
  }
  const { data } = await query;
  return (data ?? [])
    .map((b) => ({
      id: b.id,
      name: b.name,
      departmentId: b.department_id,
      departmentName: b.departments?.name ?? "",
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

/** Classes between two instants, for one batch or one lecturer, in start order. */
export async function listSessions(options: {
  batchId?: string;
  lecturerId?: string;
  from: string;
  to: string;
}): Promise<ClassSession[]> {
  const supabase = await createClient();
  let query = supabase
    .from("class_sessions")
    .select(SESSION_COLUMNS)
    .gte("starts_at", options.from)
    .lt("starts_at", options.to)
    .order("starts_at")
    .limit(300);
  if (options.batchId) query = query.eq("batch_id", options.batchId);
  if (options.lecturerId) query = query.eq("lecturer_id", options.lecturerId);
  const { data, error } = await query;
  if (error) console.error("listSessions", error);
  return ((data ?? []) as SessionRow[]).map(toSession);
}

/** One week of classes starting on the campus day `monday`. */
export function listWeekSessions(
  monday: string,
  scope: { batchId?: string; lecturerId?: string },
): Promise<ClassSession[]> {
  return listSessions({
    ...scope,
    from: campusDayStart(monday),
    to: campusDayStart(addCampusDays(monday, 7)),
  });
}

export async function getSession(id: string): Promise<ClassSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return data ? toSession(data as SessionRow) : null;
}

/** Which of these classes the signed-in student is marked present for. */
export async function myPresence(userId: string, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("session_id")
    .eq("student_id", userId)
    .in("session_id", sessionIds);
  return new Set((data ?? []).map((a) => a.session_id));
}

/**
 * Classes for Home's board: the student's batch, or the classes a member of staff teaches. Today's
 * classes, plus the next day that has any (up to a week ahead) when nothing is left today. Includes
 * whether the student is already marked present.
 */
export async function homeClasses(
  user: SessionProfile,
  now: Date = new Date(),
): Promise<{ sessions: ClassSession[]; present: Set<string> }> {
  const isStudent = user.role === "student";
  if (isStudent && !user.batchId) return { sessions: [], present: new Set() };
  const today = campusDay(now);
  const sessions = pickHomeSessions(
    await listSessions({
      ...(isStudent ? { batchId: user.batchId! } : { lecturerId: user.id }),
      from: campusDayStart(today),
      to: campusDayStart(addCampusDays(today, 8)),
    }),
    now,
  );
  const present = isStudent
    ? await myPresence(
        user.id,
        sessions.filter((s) => campusDay(s.startsAt) === today).map((s) => s.id),
      )
    : new Set<string>();
  return { sessions, present };
}

export interface RegisterRow extends PersonRef {
  avatarUrl: string | null;
  present: boolean;
  markedAt: string | null;
  source: "self" | "lecturer" | "coordinator" | null;
}

export interface AttendanceChange {
  id: number;
  studentName: string;
  present: boolean;
  reason: string;
  changedBy: string;
  changedAt: string;
}

/** A class's register: every student in the batch and whether they were there, plus corrections. */
export async function getRegister(
  session: ClassSession,
): Promise<{ rows: RegisterRow[]; changes: AttendanceChange[] }> {
  const supabase = await createClient();
  const [{ data: students }, { data: marks }, { data: changes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("batch_id", session.batchId)
      .eq("role", "student")
      .eq("status", "approved")
      .order("full_name"),
    supabase
      .from("attendance")
      .select("student_id, marked_at, source")
      .eq("session_id", session.id),
    supabase
      .from("attendance_changes")
      .select(
        "id, present, reason, changed_at, student:profiles!attendance_changes_student_id_fkey(full_name), changer:profiles!attendance_changes_changed_by_fkey(full_name)",
      )
      .eq("session_id", session.id)
      .order("changed_at", { ascending: false }),
  ]);
  const byStudent = new Map((marks ?? []).map((m) => [m.student_id, m]));
  return {
    rows: (students ?? []).map((s) => {
      const mark = byStudent.get(s.id);
      return {
        id: s.id,
        name: s.full_name,
        username: s.username,
        avatarUrl: s.avatar_url,
        present: !!mark,
        markedAt: mark?.marked_at ?? null,
        source: (mark?.source as RegisterRow["source"]) ?? null,
      };
    }),
    changes: (changes ?? []).map((c) => ({
      id: c.id,
      studentName: c.student?.full_name ?? "A student",
      present: c.present,
      reason: c.reason,
      changedBy: c.changer?.full_name ?? "Staff",
      changedAt: c.changed_at,
    })),
  };
}

/** Can the signed-in member see and correct this class's register? */
export async function canTakeRegister(sessionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_take_register", { p_session_id: sessionId });
  return data === true;
}

/** Does the signed-in member run this batch's department (coordinator or super admin)? */
export async function managesBatch(batchId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("manages_batch", { p_batch_id: batchId });
  return data === true;
}

export interface TimetableEntry {
  id: string;
  batchId: string;
  moduleCode: string | null;
  moduleName: string;
  lecturer: PersonRef | null;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  startsOn: string;
  endsOn: string;
}

/** A batch's weekly timetable, Monday first. */
export async function listEntries(batchId: string): Promise<TimetableEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("timetable_entries")
    .select(
      "id, batch_id, module_code, module_name, weekday, start_time, end_time, room, starts_on, ends_on, lecturer:profiles!timetable_entries_lecturer_id_fkey(id, full_name, username)",
    )
    .eq("batch_id", batchId)
    .order("weekday")
    .order("start_time");
  return (data ?? []).map((e) => ({
    id: e.id,
    batchId: e.batch_id,
    moduleCode: e.module_code,
    moduleName: e.module_name,
    lecturer: e.lecturer
      ? { id: e.lecturer.id, name: e.lecturer.full_name, username: e.lecturer.username }
      : null,
    weekday: e.weekday,
    startTime: e.start_time,
    endTime: e.end_time,
    room: e.room,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
  }));
}

export interface MyAttendanceRow {
  sessionId: string;
  moduleCode: string | null;
  moduleName: string;
  startsAt: string;
  endsAt: string;
  present: boolean;
  source: string | null;
}

/** The signed-in student's record: every class of their batch that has ended, newest first. */
export async function myAttendance(): Promise<MyAttendanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_attendance");
  if (error) console.error("myAttendance", error);
  return (data ?? []).map((r) => ({
    sessionId: r.session_id,
    moduleCode: r.module_code,
    moduleName: r.module_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    present: r.present,
    source: r.source,
  }));
}

export interface StudentAttendance extends PersonRef {
  avatarUrl: string | null;
  held: number;
  attended: number;
  streak: number;
  lastAlertAt: string | null;
}

/** Per-student attendance for a batch (coordinators and super admins). */
export async function batchAttendanceOverview(batchId: string): Promise<StudentAttendance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("batch_attendance_overview", {
    p_batch_id: batchId,
  });
  if (error) console.error("batchAttendanceOverview", error);
  return (data ?? []).map((r) => ({
    id: r.student_id,
    name: r.full_name,
    username: r.username,
    avatarUrl: r.avatar_url,
    held: r.held,
    attended: r.attended,
    streak: r.current_streak,
    lastAlertAt: r.last_alert_at,
  }));
}

/** A lecturer's recent classes with how many students were there (for /attendance). */
export async function recentClassesTaught(
  lecturerId: string,
  limit = 20,
): Promise<(ClassSession & { presentCount: number; batchSize: number })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_COLUMNS)
    .eq("lecturer_id", lecturerId)
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(limit);
  const sessions = ((data ?? []) as SessionRow[]).map(toSession);
  if (sessions.length === 0) return [];
  const batchIds = [...new Set(sessions.map((s) => s.batchId))];
  const [{ data: marks }, { data: students }] = await Promise.all([
    supabase
      .from("attendance")
      .select("session_id")
      .in(
        "session_id",
        sessions.map((s) => s.id),
      ),
    supabase
      .from("profiles")
      .select("batch_id")
      .in("batch_id", batchIds)
      .eq("role", "student")
      .eq("status", "approved"),
  ]);
  const count = (key: string, list: { [k: string]: string | null }[], field: string) =>
    list.filter((x) => x[field] === key).length;
  return sessions.map((s) => ({
    ...s,
    presentCount: count(s.id, marks ?? [], "session_id"),
    batchSize: count(s.batchId, students ?? [], "batch_id"),
  }));
}

/** Staff who can teach in this department (for the timetable form). */
export async function listTeachingStaff(departmentId: string): Promise<PersonRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username")
    .eq("department_id", departmentId)
    .eq("status", "approved")
    .in("role", ["lecturer", "coordinator"])
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, username: p.username }));
}

/** True for roles that see a register rather than their own attendance. */
export function isStaffViewer(user: SessionProfile): boolean {
  return roleAtLeast(user.role, "lecturer");
}
