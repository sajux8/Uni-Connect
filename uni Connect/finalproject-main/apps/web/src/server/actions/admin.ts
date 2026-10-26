"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { fromCampusInput } from "@/lib/campus-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { suspendSchema } from "@/lib/validation/moderation";
import { flushOutboxSoon } from "@/server/email/outbox";
import { USER_ROLES, type UserRole } from "@/lib/campus";
import { parseStudentId } from "@/lib/student-id";

const roleSchema = z.enum(USER_ROLES as [UserRole, ...UserRole[]]);

const approveSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
  batch: z
    .union([
      z.object({ id: z.uuid() }),
      z.object({ departmentId: z.uuid(), createNumber: z.number().int().min(1).max(999) }),
    ])
    .nullable(),
});

export type BatchChoice = { id: string } | { departmentId: string; createNumber: number } | null;

const rejectSchema = z.object({
  userId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(5, { error: "Give a short reason (at least 5 characters)." })
    .max(500, { error: "Use 500 characters or fewer." }),
});

/**
 * Approve a pending account with its role, and for students their batch.
 * Coordinators can approve students and lecturers in their own department; the database checks it.
 */
export async function approveAccount(
  userId: string,
  role: string,
  batch: BatchChoice = null,
): Promise<ActionResult> {
  await requireRole("coordinator");
  const parsed = approveSchema.safeParse({ userId, role, batch });
  if (!parsed.success) return fail("That request isn't valid.");

  const supabase = await createClient();
  let batchId: string | null = null;
  if (parsed.data.role === "student" && parsed.data.batch) {
    if ("id" in parsed.data.batch) {
      batchId = parsed.data.batch.id;
    } else {
      // "Create Computing Batch 17" straight from the approval card.
      const created = await supabase.rpc("create_batch", {
        p_department_id: parsed.data.batch.departmentId,
        p_number: parsed.data.batch.createNumber,
      });
      if (created.error) return fail(rpcError(created.error));
      batchId = created.data;
    }
  }
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: parsed.data.userId,
    p_status: "approved",
    p_role: parsed.data.role,
    p_batch_id: batchId ?? undefined,
  });
  if (error) {
    console.error("approveAccount", error);
    return fail(rpcError(error));
  }
  after(flushOutboxSoon); // the approval email
  revalidatePath("/admin", "layout");
  return ok(undefined, "Account approved.");
}

export async function approveAccounts(
  userIds: string[],
): Promise<ActionResult<{ approved: number }>> {
  await requireRole("coordinator");
  const ids = z.array(z.uuid()).max(100).safeParse(userIds);
  if (!ids.success || ids.data.length === 0) return fail("Select at least one account.");

  const supabase = await createClient();
  // Students go into the batch their ID suggests, when that batch already exists.
  const [{ data: pending }, { data: batches }] = await Promise.all([
    supabase.rpc("admin_list_accounts", { p_status: "pending", p_limit: 500 }),
    supabase.from("batches").select("id, department_id, number"),
  ]);
  let approved = 0;
  for (const id of ids.data) {
    const row = pending?.find((p) => p.id === id);
    const intake =
      row?.requested_role === "student" ? parseStudentId(row.id_number)?.intake : undefined;
    const batch = batches?.find(
      (b) => b.department_id === row?.department_id && b.number === intake,
    );
    const { error } = await supabase.rpc("admin_set_user_status", {
      p_user_id: id,
      p_status: "approved",
      p_batch_id: batch?.id,
    });
    if (error) console.error("approveAccounts", id, error);
    else approved++;
  }
  if (approved > 0) after(flushOutboxSoon);
  revalidatePath("/admin", "layout");
  if (approved === 0) return fail("No accounts were approved. Please try again.");
  return ok({ approved }, `${approved} account${approved === 1 ? "" : "s"} approved.`);
}

export async function rejectAccount(userId: string, reason: string): Promise<ActionResult> {
  await requireRole("coordinator");
  const parsed = rejectSchema.safeParse({ userId, reason });
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "That request isn't valid.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: parsed.data.userId,
    p_status: "rejected",
    p_reason: parsed.data.reason,
  });
  if (error) {
    console.error("rejectAccount", error);
    return fail(databaseErrorMessage(error));
  }
  after(flushOutboxSoon);
  revalidatePath("/admin", "layout");
  return ok(undefined, "Application rejected.");
}

// User management (/admin/users) -------------------------------------------------------------

const userId = z.uuid();

function rpcError(error: { code?: string; message?: string }): string {
  if (["22023", "23505", "23514", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message;
  }
  return databaseErrorMessage(error);
}

export async function changeUserRole(id: string, role: string): Promise<ActionResult> {
  await requireRole("coordinator");
  const parsed = z.object({ id: userId, role: roleSchema }).safeParse({ id, role });
  if (!parsed.success) return fail("That request isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: parsed.data.id,
    p_role: parsed.data.role,
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/admin", "layout");
  return ok(undefined, "Role updated.");
}

/** Suspend with a reason the member sees, until a campus date (or until reinstated). */
export async function suspendUser(
  id: string,
  reason: string,
  until?: string,
): Promise<ActionResult> {
  await requireRole("super_admin");
  const parsed = suspendSchema.safeParse({ reason, until });
  if (!userId.safeParse(id).success || !parsed.success) {
    return fail(
      parsed.error?.issues[0]?.message ?? "That request isn't valid.",
      parsed.error
        ? (z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>)
        : undefined,
    );
  }
  const end = parsed.data.until ? fromCampusInput(parsed.data.until, "date") : undefined;
  if (end && Date.parse(end) <= Date.now()) {
    return fail("Choose an end date in the future.", { until: ["Choose a date in the future."] });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: id,
    p_status: "suspended",
    p_reason: parsed.data.reason,
    p_until: end,
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/admin", "layout");
  return ok(undefined, "Account suspended.");
}

export async function reinstateUser(id: string): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!userId.safeParse(id).success) return fail("That request isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: id,
    p_status: "approved",
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/admin", "layout");
  return ok(undefined, "Account reinstated.");
}

/**
 * Approve (and carry out) or decline an account deletion request. Deleting the auth user
 * needs the service role; the RPC checks the caller is an admin and logs it first.
 */
export async function decideDeletionRequest(
  requestId: string,
  approve: boolean,
  note?: string,
): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!userId.safeParse(requestId).success) return fail("That request isn't valid.");
  const supabase = await createClient();
  const { data: targetId, error } = await supabase.rpc("decide_deletion_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note?.trim() || undefined,
  });
  if (error || !targetId) return fail(error ? rpcError(error) : "Couldn't update the request.");
  if (approve) {
    const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(targetId);
    if (deleteError) {
      console.error("decideDeletionRequest", deleteError);
      return fail("The request was approved but the account couldn't be deleted. Try again.");
    }
  }
  revalidatePath("/admin", "layout");
  return ok(undefined, approve ? "Account deleted." : "Request declined.");
}
