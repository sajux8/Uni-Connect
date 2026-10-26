"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { formSchema, type AnswerValue, type FormInput, type FormStatus } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { flushOutboxSoon } from "@/server/email/outbox";

/**
 * Feedback forms. Every write is an RPC from migration 0041 that
 * re-checks who may do it; answers are stored without the student's id.
 */

const id = z.uuid();

function rpcError(where: string, error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message.endsWith(".") ? error.message : `${error.message}.`;
  }
  console.error(where, error);
  return databaseErrorMessage(error);
}

function refresh(formId?: string) {
  revalidatePath("/forms");
  if (formId) revalidatePath(`/forms/${formId}`, "layout");
  revalidatePath("/home");
}

export async function saveForm(input: FormInput): Promise<ActionResult<{ id: string }>> {
  await requireRole("lecturer");
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_form", {
    // null creates a new form; the generated types don't know these SQL parameters accept null.
    p_form_id: (v.formId || null) as string,
    p_department_id: v.departmentId,
    p_batch_ids: v.batchIds,
    p_about_lecturer_id: (v.aboutLecturerId || null) as string,
    p_title: v.title,
    p_description: v.description,
    p_closes_at: (v.closesAt || null) as string,
    p_questions: v.questions.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      help: q.help,
      required: q.required,
      options: q.options,
      scaleMax: q.scaleMax,
      minLabel: q.minLabel,
      maxLabel: q.maxLabel,
    })),
  });
  if (error) return fail(rpcError("saveForm", error));
  refresh(data);
  return ok({ id: data }, v.formId ? "Form saved." : "Draft saved. Publish it when you're ready.");
}

export async function setFormStatus(formId: string, status: FormStatus): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(formId).success) return fail("That form doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_form_status", { p_form_id: formId, p_status: status });
  if (error) return fail(rpcError("setFormStatus", error));
  if (status === "open") after(flushOutboxSoon);
  refresh(formId);
  return ok(
    undefined,
    status === "open"
      ? "Published. Students have been told."
      : status === "closed"
        ? "Closed. No more answers are accepted."
        : "Back to draft.",
  );
}

export async function deleteForm(formId: string): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(formId).success) return fail("That form doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_form", { p_form_id: formId });
  if (error) return fail(rpcError("deleteForm", error));
  refresh();
  return ok(undefined, "Form deleted.");
}

const answerValue = z.union([
  z.string().max(2000),
  z.array(z.string().max(120)).max(20),
  z.number().int().min(1).max(10),
]);

export async function submitForm(
  formId: string,
  answers: Record<string, AnswerValue>,
): Promise<ActionResult> {
  await requireApproved();
  const parsed = z.record(z.uuid(), answerValue).safeParse(answers);
  if (!id.safeParse(formId).success || !parsed.success) return fail("Those answers aren't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_form", {
    p_form_id: formId,
    p_answers: parsed.data,
  });
  if (error) return fail(rpcError("submitForm", error));
  refresh(formId);
  return ok(undefined, "Thanks! Your answers were sent anonymously.");
}
