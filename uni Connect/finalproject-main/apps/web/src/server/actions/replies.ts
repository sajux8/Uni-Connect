"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { MIN_REPLY_BODY, replySchema, type ReplyInput } from "@/lib/validation/posts";
import { ensureMembership } from "@/server/queries/membership";

const id = z.uuid();

export async function createReply(input: ReplyInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireApproved();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return fail("That reply isn't valid.");
  const body = sanitizeRichText(parsed.data.bodyHtml);
  if (body.text.length < MIN_REPLY_BODY) return fail("Write a reply first.");

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("space_id, is_locked, status")
    .eq("id", parsed.data.postId)
    .maybeSingle();
  if (!post || post.status !== "visible") return fail("That thread isn't available.");
  if (post.is_locked) return fail("This thread is locked. No new replies can be added.");

  const membershipError = await ensureMembership(supabase, post.space_id, user.id);
  if (membershipError) return fail(membershipError);

  const { data: reply, error } = await supabase
    .from("replies")
    .insert({
      post_id: parsed.data.postId,
      author_id: user.id,
      parent_reply_id: parsed.data.parentReplyId ?? null,
      body_html: body.html,
      body_text: body.text,
    })
    .select("id")
    .single();
  if (error || !reply) {
    console.error("createReply", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath(`/posts/${parsed.data.postId}`);
  return ok({ id: reply.id }, "Reply posted.");
}

export async function updateReply(replyId: string, bodyHtml: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(replyId).success) return fail("That reply doesn't exist.");
  const body = sanitizeRichText(bodyHtml);
  if (body.text.length < MIN_REPLY_BODY) return fail("A reply can't be empty.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("replies")
    .update({ body_html: body.html, body_text: body.text, edited_at: new Date().toISOString() })
    .eq("id", replyId)
    .eq("author_id", user.id)
    .select("post_id")
    .maybeSingle();
  if (error || !data)
    return fail(error ? databaseErrorMessage(error) : "You can only edit your own replies.");
  revalidatePath(`/posts/${data.post_id}`);
  return ok(undefined, "Reply updated.");
}

export async function deleteReply(replyId: string, postId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(replyId).success) return fail("That reply doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_content", { p_kind: "reply", p_id: replyId });
  if (error) {
    console.error("deleteReply", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath(`/posts/${postId}`);
  return ok(undefined, "Reply deleted.");
}

export async function toggleHelpful(replyId: string, helpful: boolean): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(replyId).success) return fail("That reply doesn't exist.");
  const supabase = await createClient();
  const { error } = helpful
    ? await supabase.from("reply_votes").insert({ reply_id: replyId, user_id: user.id })
    : await supabase.from("reply_votes").delete().eq("reply_id", replyId).eq("user_id", user.id);
  if (error && error.code !== "23505") {
    return fail(
      error.code === "42501"
        ? "You can't mark your own reply as helpful."
        : databaseErrorMessage(error),
    );
  }
  return ok();
}

export async function acceptReply(
  replyId: string,
  postId: string,
): Promise<ActionResult<{ accepted: boolean }>> {
  await requireApproved();
  if (!id.safeParse(replyId).success) return fail("That reply doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_reply", { p_reply_id: replyId });
  if (error) {
    console.error("acceptReply", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/questions");
  const accepted = data === replyId;
  return ok({ accepted }, accepted ? "Marked as the accepted answer." : "Accepted answer removed.");
}

export async function moderateReply(
  replyId: string,
  postId: string,
  action: "hide" | "restore",
  reason?: string,
): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(replyId).success) return fail("That reply doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_reply", {
    p_reply_id: replyId,
    p_action: action,
    p_reason: reason,
  });
  if (error) {
    console.error("moderateReply", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath(`/posts/${postId}`);
  return ok(undefined, action === "hide" ? "Reply hidden." : "Reply restored.");
}
