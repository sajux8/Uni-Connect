"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();

/** Join an open space (active at once) or request to join an approval space (pending). */
export async function joinSpace(
  spaceId: string,
): Promise<ActionResult<{ status: "active" | "pending" }>> {
  const user = await requireApproved();
  if (!id.safeParse(spaceId).success) return fail("That space doesn't exist.");

  const supabase = await createClient();
  const { data: space } = await supabase
    .from("spaces")
    .select("join_policy, slug")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return fail("That space doesn't exist.");

  const status = space.join_policy === "open" ? "active" : "pending";
  const { error } = await supabase
    .from("space_members")
    .insert({ space_id: spaceId, user_id: user.id, status });
  if (error && error.code !== "23505") {
    console.error("joinSpace", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(
    { status },
    status === "active" ? "You joined the space." : "Request sent to the space moderators.",
  );
}

export async function leaveSpace(spaceId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(spaceId).success) return fail("That space doesn't exist.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", user.id);
  if (error) {
    console.error("leaveSpace", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(undefined, "You left the space.");
}

/** Joins several open spaces at once (onboarding). Approval spaces become requests. */
export async function joinSpaces(spaceIds: string[]): Promise<ActionResult<{ joined: number }>> {
  const user = await requireApproved({ allowOnboarding: true });
  const ids = z.array(z.uuid()).max(30).safeParse(spaceIds);
  if (!ids.success) return fail("Those spaces aren't valid.");
  if (ids.data.length === 0) return ok({ joined: 0 });

  const supabase = await createClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, join_policy, type")
    .in("id", ids.data);
  // Department and batch membership follows the profile, so those are skipped.
  const rows = (spaces ?? [])
    .filter((s) => s.type !== "department" && s.type !== "batch")
    .map((s) => ({
      space_id: s.id,
      user_id: user.id,
      status: s.join_policy === "open" ? ("active" as const) : ("pending" as const),
    }));
  const { error } = await supabase
    .from("space_members")
    .upsert(rows, { onConflict: "space_id,user_id", ignoreDuplicates: true });
  if (error) {
    console.error("joinSpaces", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok({ joined: rows.length });
}

const notifySchema = z.enum(["all", "important", "muted"]);

export async function setNotifyLevel(spaceId: string, level: string): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = notifySchema.safeParse(level);
  if (!parsed.success || !id.safeParse(spaceId).success) return fail("That setting isn't valid.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("space_members")
    .update({ notify_level: parsed.data })
    .eq("space_id", spaceId)
    .eq("user_id", user.id);
  if (error) {
    console.error("setNotifyLevel", error);
    return fail(databaseErrorMessage(error));
  }
  return ok(undefined, "Notification setting saved.");
}

export async function decideJoinRequest(
  spaceId: string,
  userId: string,
  approve: boolean,
): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(spaceId).success || !id.safeParse(userId).success)
    return fail("That request isn't valid.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", {
    p_space_id: spaceId,
    p_user_id: userId,
    p_approve: approve,
  });
  if (error) {
    console.error("decideJoinRequest", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/spaces", "layout");
  return ok(undefined, approve ? "Request approved." : "Request declined.");
}
