"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const targetSchema = z.object({
  type: z.enum(["post", "event", "announcement", "resource", "opportunity"]),
  id: z.uuid(),
});

export async function toggleBookmark(
  type: string,
  targetId: string,
  save: boolean,
): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = targetSchema.safeParse({ type, id: targetId });
  if (!parsed.success) return fail("That can't be bookmarked.");

  const supabase = await createClient();
  const { error } = save
    ? await supabase
        .from("bookmarks")
        .insert({ user_id: user.id, target_type: parsed.data.type, target_id: parsed.data.id })
    : await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("target_type", parsed.data.type)
        .eq("target_id", parsed.data.id);
  if (error && error.code !== "23505") return fail(databaseErrorMessage(error));
  revalidatePath("/bookmarks");
  return ok(undefined, save ? "Saved to your bookmarks." : "Removed from your bookmarks.");
}
