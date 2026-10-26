"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { opportunitySchema, type OpportunityInput } from "@/lib/careers";
import { createClient } from "@/lib/supabase/server";

/**
 * Careers. Every write is an RPC from migration 0044 that checks the
 * poster may post to that department (or campus-wide, super admins only).
 */

const id = z.uuid();

function rpcError(where: string, error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message.endsWith(".") ? error.message : `${error.message}.`;
  }
  console.error(where, error);
  return databaseErrorMessage(error);
}

function refresh(opportunityId?: string) {
  revalidatePath("/careers");
  if (opportunityId) revalidatePath(`/careers/${opportunityId}`, "layout");
}

export async function saveOpportunity(
  input: OpportunityInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("coordinator");
  const parsed = opportunitySchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }
  const o = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_opportunity", {
    // null creates a new one / means campus-wide; the generated types don't know these accept null.
    p_id: (o.id || null) as string,
    p_title: o.title,
    p_company: o.company,
    p_type: o.type,
    p_mode: o.mode,
    p_location: o.location,
    p_description: o.description,
    p_apply_url: o.applyUrl,
    p_apply_email: o.applyEmail,
    p_deadline: (o.deadline || null) as string,
    p_department_id: (o.departmentId || null) as string,
    p_batch_ids: o.batchIds,
  });
  if (error) return fail(rpcError("saveOpportunity", error));
  refresh(data);
  return ok({ id: data }, o.id ? "Saved." : "Posted. Students have been told.");
}

export async function setOpportunityStatus(
  opportunityId: string,
  status: "open" | "closed",
): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(opportunityId).success) return fail("That opportunity doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_opportunity_status", {
    p_id: opportunityId,
    p_status: status,
  });
  if (error) return fail(rpcError("setOpportunityStatus", error));
  refresh(opportunityId);
  return ok(undefined, status === "closed" ? "Closed. It moves to the Closed tab." : "Reopened.");
}

export async function deleteOpportunity(opportunityId: string): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(opportunityId).success) return fail("That opportunity doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_opportunity", { p_id: opportunityId });
  if (error) return fail(rpcError("deleteOpportunity", error));
  refresh();
  return ok(undefined, "Deleted.");
}
