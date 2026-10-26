import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { homeFor } from "@/lib/auth/routing";
import { roleAtLeast, type AccountStatus, type UserRole } from "@/lib/campus";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  email: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  requestedRole: "student" | "staff";
  departmentId: string | null;
  departmentName: string | null;
  /** Students' intake batch; null for staff and students not yet placed. */
  batchId: string | null;
  yearOfStudy: number | null;
  bio: string | null;
  interests: string[];
  expertise: string[];
  onboardingCompleted: boolean;
  statusReason: string | null;
  suspendedUntil: string | null;
}

/**
 * The signed-in user and their profile, read once per request (React `cache`).
 * Returns null when signed out or when Supabase isn't configured.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  if (!getSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Your own full row (other people only see the public columns: migration 0022).
  const { data: profile } = await supabase.rpc("my_profile").maybeSingle();
  if (!profile) return null;
  const { data: department } = profile.department_id
    ? await supabase
        .from("departments")
        .select("name")
        .eq("id", profile.department_id)
        .maybeSingle()
    : { data: null };

  return {
    id: profile.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    status: profile.status,
    requestedRole: profile.requested_role,
    departmentId: profile.department_id,
    departmentName: department?.name ?? null,
    batchId: profile.batch_id,
    yearOfStudy: profile.year_of_study,
    bio: profile.bio,
    interests: profile.interests,
    expertise: profile.expertise,
    onboardingCompleted: profile.onboarding_completed,
    statusReason: profile.status_reason,
    suspendedUntil: profile.suspended_until,
  };
});

/** Any signed-in user, whatever their status. */
export async function requireUser(next?: string): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return profile;
}

/**
 * An approved user who has finished onboarding; everyone else is sent where they belong.
 * `allowOnboarding` lets actions used *during* onboarding (e.g. joining spaces) through.
 */
export async function requireApproved(options?: {
  allowOnboarding?: boolean;
}): Promise<SessionProfile> {
  const profile = await requireUser();
  const onboarded = profile.onboardingCompleted || options?.allowOnboarding;
  if (profile.status !== "approved" || !onboarded) redirect(homeFor(profile));
  return profile;
}

/** An approved user with one of the given roles. */
/** Requires at least the lowest of `roles` (roles are a hierarchy, see `roleAtLeast`). */
export async function requireRole(...roles: UserRole[]): Promise<SessionProfile> {
  const profile = await requireApproved();
  const min = roles.reduce((a, b) => (roleAtLeast(b, a) ? a : b));
  if (!roleAtLeast(profile.role, min)) redirect("/home");
  return profile;
}
