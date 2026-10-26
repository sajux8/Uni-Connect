"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { fromCampusInput } from "@/lib/campus-time";
import { createClient } from "@/lib/supabase/server";
import {
  reasonSchema,
  timetableEntrySchema,
  type TimetableEntryInput,
} from "@/lib/validation/timetable";
import { flushOutboxSoon } from "@/server/email/outbox";

/**
 * Timetables and attendance. Every write is an RPC from migration 0038
 * that re-checks who may do it; marking present also re-checks the time on the server.
 */

const id = z.uuid();

function rpcError(where: string, error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message.endsWith(".") ? error.message : `${error.message}.`;
  }
  console.error(where, error);
  return databaseErrorMessage(error);
}

function refresh() {
  revalidatePath("/timetable", "layout");
  revalidatePath("/attendance");
  revalidatePath("/admin/timetable");
  revalidatePath("/home");
}

export async function saveTimetableEntry(
  input: TimetableEntryInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("coordinator");
  const parsed = timetableEntrySchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_timetable_entry", {
    // null creates a new entry; the generated type doesn't know the SQL parameter accepts it.
    p_entry_id: (v.entryId || null) as string,
    p_batch_id: v.batchId,
    p_module_code: v.moduleCode,
    p_module_name: v.moduleName,
    p_lecturer_id: (v.lecturerId || null) as string,
    p_weekday: v.weekday,
    p_start_time: v.startTime,
    p_end_time: v.endTime,
    p_room: v.room,
    p_starts_on: v.startsOn,
    p_ends_on: v.endsOn,
  });
  if (error) return fail(rpcError("saveTimetableEntry", error));
  refresh();
  return ok(
    { id: data },
    v.entryId
      ? "Class updated. Upcoming classes follow the change."
      : "Class added to the timetable.",
  );
}

export async function deleteTimetableEntry(entryId: string): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(entryId).success) return fail("That class doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_timetable_entry", { p_entry_id: entryId });
  if (error) return fail(rpcError("deleteTimetableEntry", error));
  refresh();
  return ok(undefined, "Removed. Past classes and their attendance are kept.");
}

export async function cancelClassSession(sessionId: string, reason: string): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(sessionId).success) return fail("That class doesn't exist.");
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Give a short reason.";
    return fail(message, { reason: [message] });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_class_session", {
    p_session_id: sessionId,
    p_reason: parsed.data,
  });
  if (error) return fail(rpcError("cancelClassSession", error));
  after(flushOutboxSoon);
  refresh();
  return ok(undefined, "Class cancelled. The batch has been told.");
}

export async function restoreClassSession(sessionId: string): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(sessionId).success) return fail("That class doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_class_session", { p_session_id: sessionId });
  if (error) return fail(rpcError("restoreClassSession", error));
  after(flushOutboxSoon);
  refresh();
  return ok(undefined, "The class is back on.");
}

export async function moveClassSession(input: {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  room: string;
  reason: string;
}): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(input.sessionId).success) return fail("That class doesn't exist.");
  const startsAt = fromCampusInput(input.startsAt, "datetime");
  const endsAt = fromCampusInput(input.endsAt, "datetime");
  if (!startsAt || !endsAt) {
    return fail("Choose the new start and end.", { startsAt: ["Choose the new start and end."] });
  }
  if (endsAt <= startsAt) {
    return fail("The class must end after it starts.", {
      endsAt: ["The class must end after it starts."],
    });
  }
  const reason = reasonSchema.safeParse(input.reason);
  if (!reason.success) {
    const message = reason.error.issues[0]?.message ?? "Give a short reason.";
    return fail(message, { reason: [message] });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_class_session", {
    p_session_id: input.sessionId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_room: input.room.trim().slice(0, 80),
    p_reason: reason.data,
  });
  if (error) return fail(rpcError("moveClassSession", error));
  after(flushOutboxSoon);
  refresh();
  return ok(undefined, "Class moved. The batch has been told.");
}

export async function markAttendance(
  sessionId: string,
): Promise<ActionResult<{ markedAt: string }>> {
  await requireApproved();
  if (!id.safeParse(sessionId).success) return fail("That class doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_attendance", { p_session_id: sessionId });
  if (error) return fail(rpcError("markAttendance", error));
  refresh();
  return ok({ markedAt: data }, "You're marked present.");
}

export async function correctAttendance(input: {
  sessionId: string;
  studentId: string;
  present: boolean;
  reason: string;
}): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(input.sessionId).success || !id.safeParse(input.studentId).success) {
    return fail("That request isn't valid.");
  }
  const reason = reasonSchema.safeParse(input.reason);
  if (!reason.success) {
    const message = reason.error.issues[0]?.message ?? "Give a short reason.";
    return fail(message, { reason: [message] });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_attendance", {
    p_session_id: input.sessionId,
    p_student_id: input.studentId,
    p_present: input.present,
    p_reason: reason.data,
  });
  if (error) return fail(rpcError("correctAttendance", error));
  refresh();
  return ok(
    undefined,
    input.present
      ? "Marked present. The student has been told."
      : "Marked absent. The student has been told.",
  );
}
