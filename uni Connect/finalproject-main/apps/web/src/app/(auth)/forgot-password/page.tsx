import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: ROUTES["/forgot-password"].title };

export default function Page() {
  return (
    <AuthCard
      eyebrow="Account help"
      title="Reset your password"
      description="Enter the email you registered with and we'll send you a link to choose a new password."
      footer={
        <Link
          href="/login"
          className="font-bold text-primary hover:underline dark:text-accent-foreground"
        >
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
