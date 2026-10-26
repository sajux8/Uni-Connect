"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { matchesSignature } from "@/lib/resources";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  ticketSchema,
  type TicketInput,
  type TicketStatus,
} from "@/lib/support";
import { flushOutboxSoon } from "@/server/email/outbox";

/**
 * Support and complaints. Tickets, replies and status changes are RPCs
 * from migration 0042. Photos are uploaded straight to the private bucket at a random path (not tied
 * to the member, so anonymous complaints stay anonymous) and re-checked here before they're attached.
 */

const id = z.uuid();
const BUCKET = "ticket-photos";

function rpcError(where: string, error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) {
    return error.message.endsWith(".") ? error.message : `${error.message}.`;
  }
  console.error(where, error);
  return databaseErrorMessage(error);
}

function refresh(ticketId?: string) {
  revalidatePath("/support");
  if (ticketId) revalidatePath(`/support/${ticketId}`);
  revalidatePath("/admin/inbox");
}

/** A one-off signed upload for a complaint photo. */
export async function preparePhotoUpload(
  mimeType: string,
): Promise<ActionResult<{ path: string; token: string }>> {
  await requireApproved();
  const ext = PHOTO_TYPES[mimeType as keyof typeof PHOTO_TYPES];
  if (!ext) return fail("Photos must be PNG or JPEG.");
  const path = `incoming/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("preparePhotoUpload", error);
    return fail("Couldn't start the upload. Please try again.");
  }
  return ok({ path, token: data.token });
}

async function verifyPhoto(path: string): Promise<string | null> {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data: info, error } = await storage.info(path);
  if (error || !info) return "The photo didn't finish uploading. Please try again.";
  const size = Number(info.size ?? 0);
  if (size < 1 || size > MAX_PHOTO_BYTES) return "Photos can be up to 5 MB.";
  const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
  const { data: signed } = await storage.createSignedUrl(path, 30);
  const head = signed
    ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" } })
        .then((r) => r.arrayBuffer())
        .then((b) => new Uint8Array(b))
        .catch(() => null)
    : null;
  if (!head || !matchesSignature(mime, head)) {
    await storage.remove([path]);
    return "That file doesn't look like a photo.";
  }
  return null;
}

export async function createTicket(input: TicketInput): Promise<ActionResult<{ id: string }>> {
  await requireApproved();
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }
  const t = parsed.data;
  if (t.photoPath) {
    const problem = await verifyPhoto(t.photoPath);
    if (problem) return fail(problem, { photo: [problem] });
  }

  const supabase = await createClient();
  const { data: ticketId, error } = await supabase.rpc("create_ticket", {
    p_kind: t.kind,
    p_category: t.category,
    p_subject: t.subject,
    p_body: t.body,
    p_anonymous: t.anonymous,
    p_route_to: t.toManagement ? "management" : "department",
  });
  if (error) return fail(rpcError("createTicket", error));

  if (t.photoPath) {
    // Trusted server step: attach the checked photo (the bucket and column aren't writable by members).
    const { error: photoError } = await createAdminClient()
      .from("tickets")
      .update({ photo_path: t.photoPath })
      .eq("id", ticketId);
    if (photoError) console.error("createTicket photo", photoError);
  }
  after(flushOutboxSoon);
  refresh(ticketId);
  return ok(
    { id: ticketId },
    t.kind === "complaint"
      ? "Complaint sent. You'll be told when it moves."
      : "Sent. You'll be told when someone replies.",
  );
}

export async function replyTicket(ticketId: string, body: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(ticketId).success) return fail("That ticket doesn't exist.");
  const text = body.trim();
  if (text.length < 1 || text.length > 4000) {
    return fail("Write a reply (up to 4,000 characters).", { body: ["Write a reply."] });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_ticket", { p_ticket_id: ticketId, p_body: text });
  if (error) return fail(rpcError("replyTicket", error));
  after(flushOutboxSoon);
  refresh(ticketId);
  return ok(undefined, "Reply sent.");
}

export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
  note: string,
): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(ticketId).success) return fail("That ticket doesn't exist.");
  if (note.length > 4000) return fail("Keep the note under 4,000 characters.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ticket_status", {
    p_ticket_id: ticketId,
    p_status: status,
    p_note: note,
  });
  if (error) return fail(rpcError("setTicketStatus", error));
  after(flushOutboxSoon);
  refresh(ticketId);
  return ok(undefined, "Updated. They've been told.");
}
