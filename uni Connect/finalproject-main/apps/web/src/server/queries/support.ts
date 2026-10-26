import "server-only";

import type { TicketKind, TicketStatus } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";

/**
 * Support and complaints. Read as the signed-in member: RLS shows a
 * ticket to its owner and its handlers only. Anonymous complaints have no author to show.
 */

export interface TicketSummary {
  id: string;
  kind: TicketKind;
  category: string;
  subject: string;
  status: TicketStatus;
  isAnonymous: boolean;
  routeTo: "department" | "management";
  author: { name: string; username: string } | null;
  batchName: string | null;
  departmentName: string | null;
  hasPhoto: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  kind: "reply" | "status";
  status: TicketStatus | null;
  body: string | null;
  fromStaff: boolean;
  authorName: string | null;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  body: string;
  messages: TicketMessage[];
}

const COLUMNS =
  "id, kind, category, subject, status, is_anonymous, route_to, photo_path, created_at, updated_at, author:profiles!tickets_author_id_fkey(full_name, username), batches(name), departments(name)";

type Row = {
  id: string;
  kind: string;
  category: string;
  subject: string;
  status: string;
  is_anonymous: boolean;
  route_to: string;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  author: { full_name: string; username: string } | null;
  batches: { name: string } | null;
  departments: { name: string } | null;
};

function toSummary(r: Row): TicketSummary {
  return {
    id: r.id,
    kind: r.kind as TicketKind,
    category: r.category,
    subject: r.subject,
    status: r.status as TicketStatus,
    isAnonymous: r.is_anonymous,
    routeTo: r.route_to as TicketSummary["routeTo"],
    author: r.author ? { name: r.author.full_name, username: r.author.username } : null,
    batchName: r.batches?.name ?? null,
    departmentName: r.departments?.name ?? null,
    hasPhoto: !!r.photo_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Tickets the signed-in member opened, newest activity first. */
export async function listMyTickets(userId: string): Promise<TicketSummary[]> {
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("ticket_owners")
    .select("ticket_id")
    .eq("user_id", userId);
  const ids = (owned ?? []).map((o) => o.ticket_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("tickets")
    .select(COLUMNS)
    .in("id", ids)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toSummary);
}

/** The handler's inbox (RLS: their department's tickets, or everything for super admins). */
export async function listInbox(filters: {
  kind: TicketKind;
  status?: TicketStatus;
  category?: string;
  batchId?: string;
}): Promise<TicketSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select(COLUMNS)
    .eq("kind", filters.kind)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.batchId) query = query.eq("batch_id", filters.batchId);
  const { data, error } = await query;
  if (error) console.error("listInbox", error);
  return ((data ?? []) as Row[]).map(toSummary);
}

export async function getTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select(`${COLUMNS}, body`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { data: messages } = await supabase
    .from("ticket_messages")
    .select(
      "id, kind, status, body, from_staff, created_at, author:profiles!ticket_messages_author_id_fkey(full_name)",
    )
    .eq("ticket_id", id)
    .order("created_at");
  return {
    ...toSummary(data as Row),
    body: (data as Row & { body: string }).body,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      kind: m.kind as TicketMessage["kind"],
      status: (m.status as TicketStatus | null) ?? null,
      body: m.body,
      fromStaff: m.from_staff,
      // Students' own messages on their ticket; staff names on staff messages.
      authorName: m.author?.full_name ?? null,
      createdAt: m.created_at,
    })),
  };
}

export async function ownsTicket(ticketId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("owns_ticket", { p_ticket_id: ticketId });
  return data === true;
}

export async function canHandleTicket(ticketId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_handle_ticket", { p_ticket_id: ticketId });
  return data === true;
}

/** Open tickets in the signed-in handler's inbox (sidebar badge). */
export async function openTicketCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("open_ticket_count");
  return data ?? 0;
}
