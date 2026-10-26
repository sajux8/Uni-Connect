"use client";

import { useActionState } from "react";

import { describedBy, Field, FormMessage, TextInput } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, updatePassword } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  const emailError = state && !state.ok ? state.fieldErrors?.email?.[0] : undefined;

  if (state?.ok) {
    return <FormMessage tone="success">{state.message}</FormMessage>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !emailError && <FormMessage tone="error">{state.error}</FormMessage>}
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
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const err = (key: string) => errors?.[key]?.[0];

  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !errors && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        id="password"
        label="New password"
        hint="8+ characters with a letter and a number."
        error={err("password")}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          showStrength
          {...describedBy("password", err("password"), true)}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={err("confirmPassword")}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          {...describedBy("confirmPassword", err("confirmPassword"))}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
