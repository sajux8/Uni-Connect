"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { describedBy, Field, inputClass } from "@/components/forms/field";
import { cn } from "@/lib/utils";
import { checkUsername } from "@/server/actions/profile";

type CheckResult = { value: string; available: boolean; message?: string };

/** Username input with a live availability check (debounced 400 ms). */
export function UsernameField({
  value,
  original,
  onChange,
  error,
}: {
  value: string;
  /** The user's current username, which is always "available" to them. */
  original: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (value === original) return;
    const timer = window.setTimeout(async () => {
      setResult({ value, ...(await checkUsername(value)) });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [value, original]);

  // Derived, so a stale answer for an earlier value is never shown.
  const check =
    value === original
      ? { state: "idle" as const }
      : result?.value !== value
        ? { state: "checking" as const }
        : result.available
          ? { state: "ok" as const }
          : { state: "bad" as const, message: result.message };

  const shownError = error ?? (check.state === "bad" ? check.message : undefined);

  return (
    <Field
      id="username"
      label="Username"
      hint={
        check.state === "ok"
          ? "That username is available."
          : `Your profile link: /u/${value || "username"}`
      }
      error={shownError}
    >
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-muted-foreground">
          @
        </span>
        <input
          id="username"
          name="username"
          value={value}
          onChange={(event) =>
            onChange(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          className={cn(inputClass, "pr-10 pl-8")}
          {...describedBy("username", shownError, true)}
        />
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2" aria-hidden>
          {check.state === "checking" && (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          )}
          {check.state === "ok" && <Check className="size-4 text-success" />}
          {check.state === "bad" && <X className="size-4 text-destructive" />}
        </span>
      </div>
    </Field>
  );
}
