"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import type { PublishStatus } from "@/lib/announcements";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import {
  announcementSchema,
  MIN_ANNOUNCEMENT_BODY,
  type AnnouncementInput,
} from "@/lib/validation/announcements";
import { flushOutboxSoon } from "@/server/email/outbox";

const id = z.uuid();

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** Validates, sanitises and turns the form into table columns. */
function toColumns(input: AnnouncementInput) {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: fail("Please fix the highlighted fields.", fieldErrors(parsed.error)) };
  }
  const body = sanitizeRichText(parsed.data.bodyHtml);
  if (body.text.length < MIN_ANNOUNCEMENT_BODY) {
    const message = `Add a bit more detail (at least ${MIN_ANNOUNCEMENT_BODY} characters).`;
    return { error: fail(message, { bodyHtml: [message] }) };
  }
  const d = parsed.data;
  const status: PublishStatus =
    d.mode === "publish" ? "published" : d.mode === "schedule" ? "scheduled" : "draft";
  return {
    status,
    columns: {
      title: d.title,
      body_html: body.html,
      body_text: body.text,
      category: d.category,
      publishing_unit: d.publishingUnit,
      audience_all: d.audienceAll,
      audience_department_ids: d.audienceAll ? [] : d.departmentIds,
      audience_years: d.audienceAll ? [] : d.years,
      is_pinned: d.pinned,
      pinned_until: d.pinned && d.pinnedUntil ? d.pinnedUntil : null,
      is_important: d.important,
      status,
      publish_at: d.mode === "schedule" ? d.publishAt || null : null,
    },
  };
}

const SAVED: Record<PublishStatus, string> = {
  published: "Announcement published.",
  scheduled: "Announcement scheduled.",
  draft: "Draft saved.",
  archived: "Announcement archived.",
};

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("lecturer");
  const prepared = toColumns(input);
  if (prepared.error) return prepared.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ ...prepared.columns, publisher_id: user.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createAnnouncement", error);
    return fail(databaseErrorMessage(error));
  }

  if (prepared.status === "published" && prepared.columns.is_important) after(flushOutboxSoon);
  revalidatePath("/", "layout");
  return ok({ id: data.id }, SAVED[prepared.status]);
}

export async function updateAnnouncement(
  announcementId: string,
  input: AnnouncementInput,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("lecturer");
  if (!id.safeParse(announcementId).success) return fail("That announcement doesn't exist.");
  const prepared = toColumns(input);
  if (prepared.error) return prepared.error;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("announcements")
    .select("status, published_at")
    .eq("id", announcementId)
    .maybeSingle();
  if (!current) return fail("That announcement doesn't exist.");
  // Once something has been published it can't go back to being a draft or scheduled.
  if (current.published_at && prepared.status !== "published") {
    return fail("This announcement has already been published. Archive it instead.");
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({
      ...prepared.columns,
      // Editing an archived announcement keeps it archived (restore it from the menu).
      status: current.status === "archived" ? "archived" : prepared.status,
      edited_at: current.published_at ? new Date().toISOString() : null,
    })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("updateAnnouncement", error);
    return fail(error ? databaseErrorMessage(error) : "You can't edit this announcement.");
  }

  if (!current.published_at && prepared.status === "published" && prepared.columns.is_important) {
    after(flushOutboxSoon);
  }
  revalidatePath("/", "layout");
  return ok(
    { id: announcementId },
    current.status === "published" ? "Changes saved." : SAVED[prepared.status],
  );
}

export async function setAnnouncementPinned(
  announcementId: string,
  pinned: boolean,
): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(announcementId).success) return fail("That announcement doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ is_pinned: pinned })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return fail(error ? databaseErrorMessage(error) : "You can't change this announcement.");
  revalidatePath("/", "layout");
  return ok(undefined, pinned ? "Pinned to the top." : "Unpinned.");
}

/** Archive (hide from members) or bring an archived announcement back. */
export async function setAnnouncementArchived(
  announcementId: string,
  archived: boolean,
): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(announcementId).success) return fail("That announcement doesn't exist.");
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("announcements")
    .select("published_at")
    .eq("id", announcementId)
    .maybeSingle();
  if (!current) return fail("That announcement doesn't exist.");
  if (!archived && !current.published_at) return fail("Publish it from the editor instead.");

  const { data, error } = await supabase
    .from("announcements")
    .update({
      status: archived ? "archived" : "published",
      is_pinned: archived ? false : undefined,
    })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return fail(error ? databaseErrorMessage(error) : "You can't change this announcement.");
  revalidatePath("/", "layout");
  return ok(undefined, archived ? "Announcement archived." : "Announcement restored.");
}

export async function deleteAnnouncement(announcementId: string): Promise<ActionResult> {
  await requireRole("lecturer");
  if (!id.safeParse(announcementId).success) return fail("That announcement doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data || data.length === 0) {
    return fail(
      "Only drafts can be deleted by their publisher. Archive published announcements instead.",
    );
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Announcement deleted.");
}

/** Called when someone opens an announcement. Clears its notification too. */
export async function markAnnouncementRead(announcementId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(announcementId).success) return fail("That announcement doesn't exist.");
  const supabase = await createClient();
  const { data: inserted } = await supabase
    .from("announcement_reads")
    .upsert(
      { announcement_id: announcementId, user_id: user.id },
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
    )
    .select("announcement_id");
  const { data: cleared } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("entity_id", announcementId)
    .is("read_at", null)
    .select("id");
  // Only refresh the badges when something changed.
  if ((inserted?.length ?? 0) > 0 || (cleared?.length ?? 0) > 0) revalidatePath("/", "layout");
  return ok();
}

export async function markAllAnnouncementsRead(): Promise<ActionResult> {
  await requireApproved();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_announcements_read");
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/", "layout");
  return ok(undefined, "All announcements marked as read.");
}
