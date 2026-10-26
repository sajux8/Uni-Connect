import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { requireUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: ROUTES["/reset-password"].title };

export default async function Page() {
  // Reached from the reset email via /auth/callback, which signs the user in.
  const user = await requireUser("/reset-password");

  return (
    <AuthCard
      eyebrow="Account help"
      title="Choose a new password"
      description={`Set a new password for ${user.email}.`}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
