import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/forms/field";
import { ROUTES } from "@/lib/routes";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: ROUTES["/login"].title };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = nextParam ? safeNextPath(nextParam) : undefined;

  const notice =
    params.checkEmail !== undefined
      ? { tone: "info" as const, text: "Check your inbox: confirm your email, then log in here." }
      : params.linkExpired !== undefined
        ? {
            tone: "error" as const,
            text: "That link has expired or was already used. Please try again.",
          }
        : null;

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in to UniConnect"
      description="Your campus updates, events and communities in one place."
      footer={
        <>
          New to UniConnect?{" "}
          <Link
            href="/register"
            className="font-bold text-primary hover:underline dark:text-accent-foreground"
          >
            Create your account
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {!getSupabaseEnv() && (
          <FormMessage tone="error">
            Sign-in isn&apos;t available yet: the database isn&apos;t connected.
          </FormMessage>
        )}
        {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
        <LoginForm next={next} />
      </div>
    </AuthCard>
  );
}
