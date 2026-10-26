"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { homeFor } from "@/lib/auth/routing";
import { requireUser } from "@/lib/auth/session";
import {
  forgotPasswordSchema,
  loginSchema,
  pendingApplicationSchema,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
} from "@/lib/validation/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { normalizeStudentId } from "@/lib/student-id";

/** Student IDs are stored in one form (AB/CSE/UNI/17/04) so the batch can be read from them. */
function tidyId(role: "student" | "staff", id: string): string {
  return role === "student" ? normalizeStudentId(id) : id;
}

const NOT_CONFIGURED = "Sign-in isn't available yet: the database isn't connected.";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** The site's own origin, for links in auth emails (works locally and on Vercel). */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100");
}

// Sign up --------------------------------------------------------------------------

export type AuthFormState = ActionResult<undefined> & { values?: Record<string, string> };

export async function signUp(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  const values = formValues(formData);
  delete values.password;
  delete values.confirmPassword;

  if (!getSupabaseEnv()) return { ...fail(NOT_CONFIGURED), values };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...fail("Please fix the highlighted fields.", fieldErrors(parsed.error)), values };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/pending`,
      // Read by the handle_new_user() trigger, which creates the pending profile.
      data: {
        full_name: input.fullName,
        requested_role: input.requestedRole,
        department_id: input.departmentId,
        id_number: tidyId(input.requestedRole, input.idNumber),
        note: input.note || null,
      },
    },
  });

  if (error) {
    const message =
      error.code === "user_already_exists" || /already registered/i.test(error.message)
        ? "An account with this email already exists. Try logging in instead."
        : error.code === "over_email_send_rate_limit" || error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : error.code === "weak_password"
            ? "That password is too easy to guess. Try a longer one."
            : error.code === "email_provider_disabled" || error.code === "signup_disabled"
              ? "New sign-ups are turned off at the moment. Please try again later."
              : "We couldn't create your account. Please try again.";
    if (message.startsWith("We couldn't")) console.error("signUp", error.code, error.message);
    return { ...fail(message), values };
  }

  // With "Confirm email" on, Supabase returns a user with no session (and, for an
  // existing email, a user with no identities). Either way: ask them to check their inbox.
  if (!data.session) redirect("/login?checkEmail=1");
  redirect("/pending");
}

// Log in / out -----------------------------------------------------------------------

export async function signIn(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: String(formData.get("email") ?? "") };
  if (!getSupabaseEnv()) return { ...fail(NOT_CONFIGURED), values };

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...fail("Please fix the highlighted fields.", fieldErrors(parsed.error)), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    const message =
      error?.code === "email_not_confirmed"
        ? "Please confirm your email first. Check your inbox for the link."
        : error?.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : "That email and password don't match an account.";
    return { ...fail(message), values };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, onboarding_completed")
    .eq("id", data.user.id)
    .maybeSingle();

  revalidatePath("/", "layout");
  if (!profile) redirect("/pending");
  const home = homeFor({
    status: profile.status,
    role: profile.role,
    onboardingCompleted: profile.onboarding_completed,
  });
  redirect(home === "/home" ? safeNextPath(formData.get("next")) : home);
}

export async function signOut(): Promise<void> {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

// Password reset ------------------------------------------------------------------------

export async function requestPasswordReset(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: String(formData.get("email") ?? "") };
  if (!getSupabaseEnv()) return { ...fail(NOT_CONFIGURED), values };

  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...fail("Please enter a valid email.", fieldErrors(parsed.error)), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) {
    return { ...fail("Too many requests. Please wait a few minutes and try again."), values };
  }
  // Same message whether or not the email exists, so this can't be used to find accounts.
  return {
    ...ok(undefined, "If an account exists for that email, a reset link is on its way."),
    values,
  };
}

export async function updatePassword(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser("/reset-password");
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(
      error.code === "same_password"
        ? "Choose a password you haven't used here before."
        : "We couldn't update your password. Please try again.",
    );
  }
  redirect(`${homeFor(user)}?passwordUpdated=1`);
}

/** From /settings/account: same rules as a reset, but stays on the page. */
export async function changePassword(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  await requireUser("/settings/account");
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(
      error.code === "same_password"
        ? "That's your current password. Choose a new one."
        : error.code === "reauthentication_needed"
          ? "For security, log out and back in, then try again."
          : "We couldn't change your password. Please try again.",
    );
  }
  return ok(undefined, "Password changed.");
}

// Pending application ----------------------------------------------------------------------

export async function updatePendingApplication(
  _prev: AuthFormState | null,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser("/pending");
  const values = formValues(formData);
  if (user.status !== "pending")
    return { ...fail("Your application has already been reviewed."), values };

  const parsed = pendingApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...fail("Please fix the highlighted fields.", fieldErrors(parsed.error)), values };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      department_id: input.departmentId,
    })
    .eq("id", user.id);
  const { error: privateError } = await supabase
    .from("profile_private")
    .update({
      id_number: tidyId(input.requestedRole, input.idNumber),
      application_note: input.note || null,
    })
    .eq("user_id", user.id);

  if (profileError || privateError) {
    console.error("updatePendingApplication", { profileError, privateError });
    return { ...fail("We couldn't save your changes. Please try again."), values };
  }
  revalidatePath("/pending");
  return { ...ok(undefined, "Your application has been updated."), values };
}
