"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { fromCampusInput } from "@/lib/campus-time";
import { createClient } from "@/lib/supabase/server";
import {
  decisionSchema,
  reportSchema,
  type DecisionInput,
  type ReportInput,
} from "@/lib/validation/moderation";
import { flushOutboxSoon } from "@/server/email/outbox";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** The moderation RPCs raise friendly messages ("You can't report your own content"). */
function rpcError(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "You've already reported this. Moderators will look at it.";
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/** Anyone can report what they can see (Flow E). */
export async function reportContent(input: ReportInput): Promise<ActionResult<{ id: string }>> {
  await requireApproved();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_content", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details || undefined,
  });
  if (error || !data) return fail(error ? rpcError(error) : "Couldn't send your report.");
  revalidatePath("/admin", "layout");
  return ok({ id: data }, "Thanks. Moderators will review this.");
}

export async function moderateReport(input: DecisionInput): Promise<ActionResult> {
  await requireRole("coordinator");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const until = parsed.data.until ? fromCampusInput(parsed.data.until, "date") : undefined;

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_report", {
    p_report_id: parsed.data.reportId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
    p_until: until,
  });
  if (error) return fail(rpcError(error));
  after(flushOutboxSoon); // warnings and "content moderated" emails
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return ok(
    undefined,
    parsed.data.action === "dismiss" ? "Report dismissed." : "Done. The report is resolved.",
  );
}
