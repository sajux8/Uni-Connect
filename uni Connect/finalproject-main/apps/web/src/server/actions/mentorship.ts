"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { canBeMentor } from "@/lib/mentorship";
import { createClient } from "@/lib/supabase/server";
import {
  mentorProfileSchema,
  mentorshipRequestSchema,
  responseNoteSchema,
  type MentorProfileInput,
  type MentorshipRequestInput,
} from "@/lib/validation/mentorship";
import { flushOutboxSoon } from "@/server/email/outbox";

const id = z.uuid();

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** The mentorship RPCs raise friendly messages ("No free mentee places right now"). */
function rpcError(error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  if (error.code === "23505") return "You already have an open request with this mentor.";
  return "Something went wrong. Please try again.";
}

function refresh() {
  revalidatePath("/mentors");
  revalidatePath("/mentorship");
  revalidatePath("/messages", "layout");
}

/** Creates or updates the viewer's mentor profile (/settings/mentor). */
export async function saveMentorProfile(input: MentorProfileInput): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = mentorProfileSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  const columns = {
    headline: d.headline,
    about: d.about,
    subjects: d.subjects,
    skills: d.skills,
    availability_note: d.availabilityNote || null,
    max_active_mentees: d.maxActiveMentees,
    is_accepting: d.isAccepting,
  };

  // Separate insert/update: an upsert would also try to update user_id, which isn't granted.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("mentor_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing && !canBeMentor(user.yearOfStudy)) {
    return fail("Mentor profiles are for students in Year 2 or above.");
  }
  const { error } = existing
    ? await supabase.from("mentor_profiles").update(columns).eq("user_id", user.id)
    : await supabase.from("mentor_profiles").insert({ user_id: user.id, ...columns });
  if (error) return fail(rpcError(error));
  revalidatePath("/settings/mentor");
  refresh();
  return ok(
    undefined,
    d.isAccepting
      ? "Saved. You're listed on the mentor directory."
      : "Saved. You're not taking new requests.",
  );
}

/** Removes the mentor profile. Requests still waiting are declined; active mentorships continue. */
export async function removeMentorProfile(): Promise<ActionResult> {
  const user = await requireApproved();
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_profiles").delete().eq("user_id", user.id);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/settings/mentor");
  refresh();
  return ok(undefined, "Your mentor profile was removed.");
}

export async function requestMentorship(
  input: MentorshipRequestInput,
): Promise<ActionResult<{ id: string }>> {
  await requireApproved();
  const parsed = mentorshipRequestSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_mentorship", {
    p_mentor_id: parsed.data.mentorId,
    p_topic: parsed.data.topic,
    p_message: parsed.data.message,
  });
  if (error || !data) return fail(error ? rpcError(error) : "Couldn't send your request.");
  after(flushOutboxSoon);
  refresh();
  return ok({ id: data }, "Request sent. You'll be notified when they answer.");
}

export async function respondToRequest(
  requestId: string,
  accept: boolean,
  note?: string,
): Promise<ActionResult<{ conversationId: string | null }>> {
  await requireApproved();
  const parsedNote = responseNoteSchema.safeParse(note ?? "");
  if (!id.safeParse(requestId).success || !parsedNote.success) {
    return fail(parsedNote.error?.issues[0]?.message ?? "That request isn't valid.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_mentorship_request", {
    p_request_id: requestId,
    p_accept: accept,
    p_note: parsedNote.data || undefined,
  });
  if (error) return fail(rpcError(error));
  if (accept) after(flushOutboxSoon);
  refresh();
  return ok(
    { conversationId: data ?? null },
    accept ? "Accepted. Your conversation is open." : "Request declined.",
  );
}

export async function cancelMentorshipRequest(requestId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(requestId).success) return fail("That request isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_mentorship_request", { p_request_id: requestId });
  if (error) return fail(rpcError(error));
  refresh();
  return ok(undefined, "Request withdrawn.");
}

export async function endMentorship(requestId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(requestId).success) return fail("That mentorship isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_mentorship", { p_request_id: requestId });
  if (error) return fail(rpcError(error));
  refresh();
  return ok(undefined, "Mentorship ended. The conversation stays readable.");
}
