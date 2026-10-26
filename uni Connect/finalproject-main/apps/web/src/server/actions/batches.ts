"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Batches, lecturers, class reps and club captains. Every RPC re-checks
 * that the caller is a super admin or the coordinator of the department concerned.
 */

const id = z.uuid();

function rpcError(error: { code?: string; message?: string }): string {
  if (["22023", "23505", "23514", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message;
  }
  return databaseErrorMessage(error);
}

function done(message: string): ActionResult {
  revalidatePath("/admin", "layout");
  revalidatePath("/spaces", "layout");
  return ok(undefined, message);
}

export async function createBatch(
  departmentId: string,
  number: number,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("coordinator");
  const parsed = z
    .object({ departmentId: id, number: z.number().int().min(1).max(999) })
    .safeParse({ departmentId, number });
  if (!parsed.success) return fail("Enter a batch number between 1 and 999.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_batch", {
    p_department_id: parsed.data.departmentId,
    p_number: parsed.data.number,
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/admin", "layout");
  revalidatePath("/spaces", "layout");
  return ok({ id: data }, "Batch created.");
}

export async function setBatchLecturer(
  batchId: string,
  lecturerId: string,
  assign: boolean,
): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(batchId).success || !id.safeParse(lecturerId).success) {
    return fail("That request isn't valid.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_batch_lecturer", {
    p_batch_id: batchId,
    p_lecturer_id: lecturerId,
    p_assign: assign,
  });
  if (error) return fail(rpcError(error));
  return done(assign ? "Lecturer assigned." : "Lecturer removed.");
}

export async function setBatchRep(batchId: string, userId: string | null): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(batchId).success || (userId !== null && !id.safeParse(userId).success)) {
    return fail("That request isn't valid.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_batch_rep", {
    p_batch_id: batchId,
    // null clears the rep; the generated type doesn't know the SQL parameter accepts it.
    p_user_id: userId as string,
  });
  if (error) return fail(rpcError(error));
  return done(userId ? "Class rep updated." : "Class rep removed.");
}

export async function assignStudentBatch(
  userId: string,
  batchId: string | null,
): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(userId).success || (batchId !== null && !id.safeParse(batchId).success)) {
    return fail("That request isn't valid.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_student_batch", {
    p_user_id: userId,
    // null takes the student out of their batch (see above).
    p_batch_id: batchId as string,
  });
  if (error) return fail(rpcError(error));
  return done(batchId ? "Batch updated." : "Removed from the batch.");
}

export async function setSpaceRole(
  spaceId: string,
  userId: string,
  role: "member" | "moderator" | "captain",
): Promise<ActionResult> {
  await requireRole("coordinator");
  const parsed = z
    .object({ spaceId: id, userId: id, role: z.enum(["member", "moderator", "captain"]) })
    .safeParse({ spaceId, userId, role });
  if (!parsed.success) return fail("That request isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_space_role", {
    p_space_id: parsed.data.spaceId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return fail(rpcError(error));
  return done(
    role === "captain"
      ? "Captain set."
      : role === "moderator"
        ? "Moderator added."
        : "Role removed.",
  );
}
