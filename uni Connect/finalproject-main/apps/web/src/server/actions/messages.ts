"use server";

import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { messageBodySchema } from "@/lib/validation/mentorship";
import { listMessages, toChatMessage, type ChatMessage } from "@/server/queries/messages";

const id = z.uuid();

/** RLS refuses the insert when the mentorship has ended or someone is blocked. */
function messageError(error: { code?: string; message?: string }): string {
  if (error.code === "22023" && error.message) return error.message;
  if (error.code === "42501") return "You can't send messages in this conversation any more.";
  if (error.code === "23514") return "That message can't be sent.";
  return "Couldn't send. Check your connection and try again.";
}

const COLUMNS = "id, sender_id, body, created_at, edited_at, deleted_at";

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult<ChatMessage>> {
  const user = await requireApproved();
  const parsed = messageBodySchema.safeParse(body);
  if (!id.safeParse(conversationId).success) return fail("That conversation isn't valid.");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a message first.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: parsed.data })
    .select(COLUMNS)
    .single();
  if (error || !data) return fail(error ? messageError(error) : "Couldn't send.");
  return ok(toChatMessage(data));
}

export async function editMessage(
  messageId: string,
  body: string,
): Promise<ActionResult<ChatMessage>> {
  const user = await requireApproved();
  const parsed = messageBodySchema.safeParse(body);
  if (!id.safeParse(messageId).success) return fail("That message isn't valid.");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a message first.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .update({ body: parsed.data })
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return fail(messageError(error));
  if (!data) return fail("You can only edit your own messages.");
  return ok(toChatMessage(data), "Message edited.");
}

export async function deleteMessage(messageId: string): Promise<ActionResult<ChatMessage>> {
  const user = await requireApproved();
  if (!id.safeParse(messageId).success) return fail("That message isn't valid.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return fail(messageError(error));
  if (!data) return fail("You can only delete your own messages.");
  return ok(toChatMessage(data), "Message deleted.");
}

/** Called when the chat is opened and as new messages arrive while it's open. */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(conversationId).success) return fail("That conversation isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) return fail("Couldn't update.");
  return ok();
}

export async function loadEarlierMessages(
  conversationId: string,
  before: string,
): Promise<ActionResult<{ messages: ChatMessage[]; hasMore: boolean }>> {
  await requireApproved();
  if (!id.safeParse(conversationId).success || Number.isNaN(Date.parse(before))) {
    return fail("That request isn't valid.");
  }
  return ok(await listMessages(conversationId, before));
}
