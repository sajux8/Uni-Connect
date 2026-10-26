"use client";

import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import * as z from "zod";

import { ApplicationFields, type DepartmentOption } from "@/components/auth/application-fields";
import {
  describedBy,
  Field,
  FormErrorSummary,
  FormMessage,
  focusField,
  TextInput,
  type FieldErrorMap,
} from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { registerSchema } from "@/lib/validation/auth";
import { signUp } from "@/server/actions/auth";

const ROLE_CHOICES = [
  { value: "student", label: "Student", description: "Studying on campus", icon: GraduationCap },
  { value: "staff", label: "Staff", description: "Lecturer or staff", icon: BriefcaseBusiness },
] as const;

/** Field ids in page order, with the names used in the error summary. */
const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  departmentId: "Department",
  idNumber: "Student or staff ID",
  note: "Note for your coordinator",
  consent: "Community rules and privacy notice",
};

export function RegisterForm({ departments }: { departments: DepartmentOption[] }) {
  const [state, action, pending] = useActionState(signUp, null);
  const values = state?.values;
  // Checked in the browser first (same schema as the server), so a mistake never
  // clears the passwords; the server's answer is used for anything it finds later.
  const [clientErrors, setClientErrors] = useState<FieldErrorMap | null>(null);
  const serverErrors = state && !state.ok ? state.fieldErrors : undefined;
  const errors = clientErrors ?? serverErrors;
  const err = (key: string) => errors?.[key]?.[0];
  const [role, setRole] = useState<"student" | "staff">(
    values?.requestedRole === "staff" ? "staff" : "student",
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (parsed.success) {
      setClientErrors(null);
      return;
    }
    event.preventDefault();
    const fieldErrors = z.flattenError(parsed.error).fieldErrors as FieldErrorMap;
    setClientErrors(fieldErrors);
    const first = Object.keys(FIELD_LABELS).find((key) => fieldErrors[key]?.[0]);
    if (first) focusField(first);
  }

  /** Editing a field clears its error. */
  function onChange(event: React.FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    if (name && errors?.[name]) setClientErrors({ ...errors, [name]: undefined });
  }

  return (
    <form action={action} onSubmit={onSubmit} onChange={onChange} className="space-y-5" noValidate>
      {errors && Object.values(errors).some((e) => e?.[0]) ? (
        <FormErrorSummary errors={errors} labels={FIELD_LABELS} />
      ) : (
        state && !state.ok && <FormMessage tone="error">{state.error}</FormMessage>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[13.5px] font-bold">I am joining as</legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] bg-card p-3.5 transition-[border-color,box-shadow,background-color] has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                role === choice.value
                  ? "border-primary bg-accent shadow-soft"
                  : "border-input hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="requestedRole"
                value={choice.value}
                checked={role === choice.value}
                onChange={() => setRole(choice.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  role === choice.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <choice.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{choice.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {choice.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {role === "staff" && (
          <p className="text-[13px] text-muted-foreground">
            Staff who publish announcements or events are given the Organizer role when an admin
            approves the account.
          </p>
        )}
      </fieldset>

      <Field id="fullName" label="Full name" error={err("fullName")}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={values?.fullName}
          {...describedBy("fullName", err("fullName"))}
        />
      </Field>

      <Field
        id="email"
        label="Email"
        hint="Use your campus email if you have one. We never ask for a phone number."
        error={err("email")}
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={values?.email}
          {...describedBy("email", err("email"), true)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="password"
          label="Password"
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
        <Field id="confirmPassword" label="Confirm password" error={err("confirmPassword")}>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            {...describedBy("confirmPassword", err("confirmPassword"))}
          />
        </Field>
      </div>

      <ApplicationFields departments={departments} role={role} values={values} errors={errors} />

      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-[14px] leading-snug">
          <input
            id="consent"
            type="checkbox"
            name="consent"
            defaultChecked={values?.consent === "on"}
            className="mt-0.5 size-[18px] shrink-0 accent-primary"
            {...describedBy("consent", err("consent"))}
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-primary underline-offset-2 hover:underline dark:text-accent-foreground"
            >
              community rules
            </Link>{" "}
            and the{" "}
            <Link
              href="/privacy"
              className="font-semibold text-primary underline-offset-2 hover:underline dark:text-accent-foreground"
            >
              privacy notice
            </Link>
            .
          </span>
        </label>
        {err("consent") && (
          <p id="consent-error" role="alert" className="text-[13px] font-medium text-destructive">
            {err("consent")}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        Your coordinator checks every new account before it can join the community.
      </p>
    </form>
  );
}
