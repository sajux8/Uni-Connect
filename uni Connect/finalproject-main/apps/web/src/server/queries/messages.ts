import "server-only";

import type { MentorshipStatus } from "@/lib/mentorship";
import { createClient } from "@/lib/supabase/server";

export interface ConversationSummary {
  id: string;
  partner: { id: string; name: string; username: string | null; avatarUrl: string | null };
  requestId: string;
  topic: string;
  status: MentorshipStatus;
  iAmMentor: boolean;
  lastMessageAt: string;
  lastMessage: { body: string; fromMe: boolean; deleted: boolean } | null;
  unread: number;
}

/** The viewer's conversations, most recent first (RLS: participants only). */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) {
    console.error("listConversations", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.conversation_id,
    partner: {
      id: c.partner_id,
      name: c.partner_name ?? "Former member",
      username: c.partner_username,
      avatarUrl: c.partner_avatar,
    },
    requestId: c.request_id,
    topic: c.topic,
    status: c.mentorship_status,
    iAmMentor: c.i_am_mentor,
    lastMessageAt: c.last_message_at,
    lastMessage:
      c.last_sender_id === null && c.last_body === null
        ? null
        : {
            body: c.last_body ?? "",
            fromMe: c.last_sender_id === userId,
            deleted: c.last_deleted,
          },
    unread: c.unread_count,
  }));
}

export async function unreadConversationCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_conversation_count");
  return data ?? 0;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export const MESSAGE_PAGE_SIZE = 50;

type MessageRow = {
  id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export function toChatMessage(m: MessageRow): ChatMessage {
  return {
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
  };
}

/** A page of messages in time order; `before` loads older ones. */
export async function listMessages(
  conversationId: string,
  before?: string,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("messages")
    .select("id, sender_id, body, created_at, edited_at, deleted_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) {
    console.error("listMessages", error);
    return { messages: [], hasMore: false };
  }
  const rows = data ?? [];
  return {
    messages: rows.slice(0, MESSAGE_PAGE_SIZE).reverse().map(toChatMessage),
    hasMore: rows.length > MESSAGE_PAGE_SIZE,
  };
}

export interface ConversationDetail {
  id: string;
  request: {
    id: string;
    topic: string;
    message: string;
    responseNote: string | null;
    status: MentorshipStatus;
    createdAt: string;
    endedBy: string | null;
    iAmMentor: boolean;
  };
  partner: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    departmentName: string | null;
  };
  /** When the other person last opened the conversation (for "Seen"). */
  partnerLastReadAt: string | null;
  canMessage: boolean;
  /** The viewer has blocked the other person. */
  blockedByMe: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
}

/** Everything the chat screen needs, or null when the viewer isn't a participant. */
export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationDetail | null> {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, mentorship_requests!conversations_mentorship_request_id_fkey(id, topic, message, response_note, status, created_at, ended_by, mentor_id, mentee_id)",
    )
    .eq("id", conversationId)
    .maybeSingle();
  const request = conversation?.mentorship_requests;
  if (!conversation || !request) return null;

  const partnerId = request.mentor_id === userId ? request.mentee_id : request.mentor_id;
  const [{ data: participants }, { data: card }, { data: canMessage }, { data: block }, page] =
    await Promise.all([
      supabase
        .from("conversation_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId),
      supabase
        .from("profile_cards")
        .select("full_name, username, avatar_url, department_name")
        .eq("id", partnerId)
        .maybeSingle(),
      supabase.rpc("can_message", { p_conversation_id: conversationId }),
      supabase.from("user_blocks").select("blocked_id").eq("blocked_id", partnerId).maybeSingle(),
      listMessages(conversationId),
    ]);

  return {
    id: conversation.id,
    request: {
      id: request.id,
      topic: request.topic,
      message: request.message,
      responseNote: request.response_note,
      status: request.status,
      createdAt: request.created_at,
      endedBy: request.ended_by,
      iAmMentor: request.mentor_id === userId,
    },
    partner: {
      id: partnerId,
      name: card?.full_name ?? "Former member",
      username: card?.username ?? null,
      avatarUrl: card?.avatar_url ?? null,
      departmentName: card?.department_name ?? null,
    },
    partnerLastReadAt: participants?.find((p) => p.user_id === partnerId)?.last_read_at ?? null,
    canMessage: Boolean(canMessage),
    blockedByMe: Boolean(block),
    messages: page.messages,
    hasMore: page.hasMore,
  };
}
