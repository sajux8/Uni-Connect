import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { FormMessage } from "@/components/forms/field";
import { ROUTES } from "@/lib/routes";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/register"].title };

export default async function Page() {
  const departments = await listDepartments();

  return (
    <AuthCard
      size="lg"
      eyebrow="Create your account"
      title="Join your campus"
      description="Tell us who you are. Your department's coordinator verifies every new member, usually within a day."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:underline dark:text-accent-foreground"
          >
            Log in
          </Link>
        </>
      }
    >
      {!getSupabaseEnv() && (
        <div className="mb-5">
          <FormMessage tone="error">
            Registration isn&apos;t available yet: the database isn&apos;t connected.
          </FormMessage>
        </div>
      )}
      <RegisterForm departments={departments} />
    </AuthCard>
  );
}
