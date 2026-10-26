"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApplicationFields, type DepartmentOption } from "@/components/auth/application-fields";
import { describedBy, Field, FormMessage, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updatePendingApplication } from "@/server/actions/auth";

/**
 * Listens to the user's own profile row (Realtime, RLS-filtered) and moves them on
 * as soon as an admin approves or rejects the application.
 */
export function ApprovalListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    // The browser client reads the session from cookies lazily; hand the token to
    // Realtime before subscribing, or the socket joins as anonymous and RLS hides the row.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`profile:${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const status = (payload.new as { status?: string }).status;
            if (status === "approved") {
              toast.success("You're approved! Welcome to UniConnect.");
              router.replace("/onboarding");
            } else if (status === "rejected" || status === "suspended") {
              router.replace(`/${status}`);
            }
          },
        )
        .subscribe();
    });

    // Fallback in case the realtime connection drops: re-check every minute.
    const interval = window.setInterval(() => router.refresh(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}

export function EditApplication({
  departments,
  role,
  initial,
}: {
  departments: DepartmentOption[];
  role: "student" | "staff";
  initial: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof updatePendingApplication>> | null,
      formData: FormData,
    ) => {
      const result = await updatePendingApplication(prev, formData);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        setOpen(false);
      }
      return result;
    },
    null,
  );
  const values = state?.values ?? initial;
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const nameError = errors?.fullName?.[0];

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        <Pencil data-icon="inline-start" />
        Edit details
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border bg-surface-tint p-4 sm:p-5"
      noValidate
    >
      <input type="hidden" name="requestedRole" value={role} />
      {state && !state.ok && !errors && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field id="fullName" label="Full name" error={nameError}>
        <TextInput
          id="fullName"
          name="fullName"
          required
          maxLength={80}
          defaultValue={values.fullName}
          {...describedBy("fullName", nameError)}
        />
      </Field>
      <ApplicationFields departments={departments} role={role} values={values} errors={errors} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
