"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import type { RegistrationStatus } from "@/lib/events";
import { sanitizeRichText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import {
  cancelEventSchema,
  eventSchema,
  MIN_EVENT_DESCRIPTION,
  type EventInput,
} from "@/lib/validation/events";
import { flushOutboxSoon } from "@/server/email/outbox";

const id = z.uuid();

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** Validates, sanitises and maps the form onto table columns. */
function toColumns(input: EventInput) {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: fail("Please fix the highlighted fields.", fieldErrors(parsed.error)) };
  }
  const body = sanitizeRichText(parsed.data.descriptionHtml);
  if (body.text.length < MIN_EVENT_DESCRIPTION) {
    const message = `Describe the event in a bit more detail (at least ${MIN_EVENT_DESCRIPTION} characters).`;
    return { error: fail(message, { descriptionHtml: [message] }) };
  }
  const d = parsed.data;
  return {
    data: d,
    columns: {
      title: d.title,
      description_html: body.html,
      description_text: body.text,
      category: d.category,
      organizing_unit: d.organizingUnit,
      format: d.format,
      venue: d.format === "online" ? null : d.venue || null,
      location_details: d.format === "online" ? null : d.locationDetails || null,
      online_url: d.format === "in_person" ? null : d.onlineUrl || null,
      starts_at: d.startsAt,
      ends_at: d.endsAt,
      registration_deadline: d.registrationDeadline || null,
      capacity: d.capacity,
      waitlist_enabled: d.waitlistEnabled,
      eligibility_department_ids: d.departmentIds,
      eligibility_years: d.years,
      eligibility_note: d.eligibilityNote || null,
      cover_url: d.coverUrl || null,
      space_id: d.spaceId || null,
      status: d.status,
    },
  };
}

function eventError(error: { code?: string; message?: string } | null): string {
  // The capacity and placement triggers explain themselves ("You can't put an event there").
  if (["22023", "42501"].includes(error?.code ?? "") && error?.message) return error.message;
  return databaseErrorMessage(error);
}

/** The registration RPCs raise friendly messages ("This event is full", "…has closed"). */
function registrationError(error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export async function createEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireApproved();
  const prepared = toColumns(input);
  if (prepared.error) return prepared.error;
  if (prepared.data.status === "published" && new Date(prepared.data.startsAt) <= new Date()) {
    return fail("An event can't start in the past.", {
      startsAt: ["Choose a time in the future."],
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...prepared.columns, organizer_id: user.id })
    .select("id, status")
    .single();
  if (error || !data) {
    console.error("createEvent", error);
    return fail(eventError(error));
  }
  if (data.status === "pending_review") after(flushOutboxSoon);
  revalidatePath("/events", "layout");
  return ok(
    { id: data.id },
    data.status === "pending_review"
      ? "Sent for approval. You'll be told when it's published."
      : data.status === "published"
        ? "Event published."
        : "Draft saved.",
  );
}

export async function updateEvent(
  eventId: string,
  input: EventInput,
): Promise<ActionResult<{ id: string }>> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const prepared = toColumns(input);
  if (prepared.error) return prepared.error;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("events")
    .select("status, published_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!current) return fail("That event doesn't exist.");
  if (current.status === "cancelled") return fail("This event was cancelled and can't be edited.");
  if (current.published_at && prepared.data.status === "draft") {
    return fail(
      "This event has been published. Cancel it instead of turning it back into a draft.",
    );
  }

  const { data, error } = await supabase
    .from("events")
    .update(prepared.columns)
    .eq("id", eventId)
    .select("id, status")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("updateEvent", error);
    return fail(error ? eventError(error) : "You can't edit this event.");
  }

  // Changes to time or place notify registrants (by email too): send it straight away.
  if (current.published_at) after(flushOutboxSoon);
  revalidatePath("/events", "layout");
  return ok(
    { id: eventId },
    data.status === "pending_review" && current.status !== "pending_review"
      ? "Sent for approval. You'll be told when it's published."
      : current.status !== "published" && data.status === "published"
        ? "Event published."
        : "Changes saved.",
  );
}

export async function cancelEvent(eventId: string, reason: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const parsed = cancelEventSchema.safeParse(reason);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give a reason.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled", cancel_reason: parsed.data })
    .eq("id", eventId)
    .eq("status", "published")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("cancelEvent", error);
    return fail(error ? databaseErrorMessage(error) : "Only published events can be cancelled.");
  }
  after(flushOutboxSoon);
  revalidatePath("/events", "layout");
  return ok(undefined, "Event cancelled. Everyone registered has been told.");
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data || data.length === 0) {
    return fail("Only drafts can be deleted. Cancel a published event instead.");
  }
  revalidatePath("/events", "layout");
  return ok(undefined, "Event deleted.");
}

/** Approve (publishes it) or decline with a reason (Phase C). The RPC checks the reviewer. */
export async function reviewEvent(
  eventId: string,
  approve: boolean,
  note: string,
): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const reason = note.trim();
  if (!approve && reason.length < 5) {
    return fail("Tell the organizer why (at least 5 characters).", {
      note: ["Tell the organizer why (at least 5 characters)."],
    });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_event", {
    p_event_id: eventId,
    p_approve: approve,
    p_note: reason.slice(0, 500),
  });
  if (error) {
    if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) {
      return fail(error.message);
    }
    console.error("reviewEvent", error);
    return fail(databaseErrorMessage(error));
  }
  after(flushOutboxSoon);
  revalidatePath("/events", "layout");
  return ok(
    undefined,
    approve ? "Approved and published." : "Declined. The organizer has been told.",
  );
}

export async function registerForEvent(
  eventId: string,
): Promise<ActionResult<{ status: RegistrationStatus; waitlistPosition: number | null }>> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_event", { p_event_id: eventId });
  const row = data?.[0];
  if (error || !row) {
    if (error && !["22023", "42501", "P0002"].includes(error.code ?? "")) {
      console.error("registerForEvent", error);
    }
    return fail(error ? registrationError(error) : "Couldn't register. Please try again.");
  }
  revalidatePath("/events", "layout");
  revalidatePath("/home");
  return ok(
    { status: row.status, waitlistPosition: row.waitlist_position },
    row.status === "registered"
      ? "You're registered. See you there!"
      : `The event is full, so you're #${row.waitlist_position} on the waitlist.`,
  );
}

export async function cancelRegistration(eventId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(eventId).success) return fail("That event doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", { p_event_id: eventId });
  if (error) {
    if (!["22023", "P0002"].includes(error.code ?? "")) console.error("cancelRegistration", error);
    return fail(registrationError(error));
  }
  // Someone may have been promoted from the waitlist (and emailed).
  after(flushOutboxSoon);
  revalidatePath("/events", "layout");
  revalidatePath("/home");
  return ok(undefined, "Registration cancelled.");
}
