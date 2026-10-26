"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireUser } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  deletionRequestSchema,
  onboardingSchema,
  privacySchema,
  profileSchema,
  usernameSchema,
  type OnboardingInput,
  type PrivacyInput,
  type ProfileInput,
} from "@/lib/validation/profile";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function usernameTaken(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" && /username/.test(error.message ?? "");
}

/** Live check used by the username fields. */
export async function checkUsername(
  username: string,
): Promise<{ available: boolean; message?: string }> {
  if (!getSupabaseEnv()) return { available: false, message: "Not connected." };
  await requireUser();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { available: false, message: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_username_available", {
    p_username: parsed.data,
  });
  if (error) return { available: false, message: "Couldn't check right now." };
  return data ? { available: true } : { available: false, message: "That username is taken." };
}

/** Last step of /onboarding. Approved users only (the proxy sends everyone else away). */
export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const user = await requireUser();
  if (user.status !== "approved") return fail("Your account hasn't been approved yet.");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fail("Please check your details.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      bio: parsed.data.bio || null,
      interests: parsed.data.interests,
      expertise: parsed.data.expertise,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) {
    if (usernameTaken(error))
      return fail("That username is taken.", { username: ["That username is taken."] });
    console.error("completeOnboarding", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      username: data.username,
      bio: data.bio || null,
      department_id: data.departmentId,
      // Staff don't have a year of study.
      year_of_study: user.requestedRole === "staff" ? null : data.yearOfStudy,
      interests: data.interests,
      expertise: data.expertise,
    })
    .eq("id", user.id);

  if (error) {
    if (usernameTaken(error))
      return fail("That username is taken.", { username: ["That username is taken."] });
    console.error("updateProfile", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Profile saved.");
}

export async function updatePrivacy(input: PrivacyInput): Promise<ActionResult> {
  const user = await requireApproved();
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) return fail("Please check your choices.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      profile_visibility: parsed.data.profileVisibility,
      show_year: parsed.data.showYear,
      mentorship_requests_from: parsed.data.mentorshipRequestsFrom,
    })
    .eq("id", user.id);
  if (error) {
    console.error("updatePrivacy", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/settings/privacy");
  revalidatePath(`/u/${user.username}`);
  return ok(undefined, "Privacy settings saved.");
}

/**
 * Saves the public URL of an avatar the browser just uploaded to the `avatars`
 * bucket (storage policies only allow writing inside the user's own folder).
 * Pass null to remove the photo.
 */
export async function updateAvatar(avatarUrl: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (user.status !== "approved") return fail("Your account hasn't been approved yet.");

  const env = getSupabaseEnv();
  const prefix = `${env?.url}/storage/v1/object/public/avatars/${user.id}/`;
  if (avatarUrl !== null && !avatarUrl.startsWith(prefix)) return fail("That image can't be used.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (error) {
    console.error("updateAvatar", error);
    return fail(databaseErrorMessage(error));
  }

  // Tidy up older uploads; the new one stays.
  const keep = avatarUrl?.slice(prefix.length);
  const { data: files } = await supabase.storage.from("avatars").list(user.id);
  const stale = (files ?? []).filter((f) => f.name !== keep).map((f) => `${user.id}/${f.name}`);
  if (stale.length > 0) await supabase.storage.from("avatars").remove(stale);

  revalidatePath("/", "layout");
  return ok(undefined, avatarUrl ? "Photo updated." : "Photo removed.");
}

export async function requestAccountDeletion(reason: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deletionRequestSchema.safeParse({ reason });
  if (!parsed.success) return fail("Please shorten your reason.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: user.id, reason: parsed.data.reason || null });
  if (error) {
    if (error.code === "23505")
      return fail("You already have a deletion request waiting for an admin.");
    console.error("requestAccountDeletion", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/settings/account");
  return ok(undefined, "Request sent. An admin will process it and contact you by email.");
}

const userId = z.uuid();

/**
 * Blocks someone: they can't message you or send you mentorship requests, and anything
 * open between you is closed (migration 0018). They aren't told.
 */
export async function blockUser(targetId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!userId.safeParse(targetId).success || targetId === user.id) {
    return fail("You can't block that account.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: targetId });
  if (error && error.code !== "23505") {
    console.error("blockUser", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Blocked. They can't message you or send you requests.");
}

export async function unblockUser(targetId: string): Promise<ActionResult> {
  const user = await requireApproved();
  if (!userId.safeParse(targetId).success) return fail("That account isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);
  if (error) {
    console.error("unblockUser", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Unblocked.");
}
