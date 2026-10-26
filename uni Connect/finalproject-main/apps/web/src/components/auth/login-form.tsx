"use client";

import Link from "next/link";
import { useActionState } from "react";

import { describedBy, Field, FormMessage, TextInput } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { signIn } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const emailError = errors?.email?.[0];
  const passwordError = errors?.password?.[0];

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state && !state.ok && !errors && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field id="email" label="Email" error={emailError}>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.values?.email}
          {...describedBy("email", emailError)}
        />
      </Field>

      <Field id="password" label="Password" error={passwordError}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          {...describedBy("password", passwordError)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-primary hover:underline dark:text-accent-foreground"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
