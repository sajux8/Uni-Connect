"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, FormMessage, TextArea } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/server/actions/auth";
import { requestAccountDeletion } from "@/server/actions/profile";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const err = (key: string) => errors?.[key]?.[0];

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Password changed.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate>
      <SettingsSection
        title="Password"
        description="Use at least 8 characters with a letter and a number."
        footer={
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        }
      >
        {state && !state.ok && !errors && <FormMessage tone="error">{state.error}</FormMessage>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="password" label="New password" error={err("password")}>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              showStrength
              {...describedBy("password", err("password"))}
            />
          </Field>
          <Field id="confirmPassword" label="Confirm new password" error={err("confirmPassword")}>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              {...describedBy("confirmPassword", err("confirmPassword"))}
            />
          </Field>
        </div>
      </SettingsSection>
    </form>
  );
}

export function DeleteAccountSection({ hasOpenRequest }: { hasOpenRequest: boolean }) {
  const [reason, setReason] = useState("");
  const [requested, setRequested] = useState(hasOpenRequest);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await requestAccountDeletion(reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRequested(true);
      toast.success(result.message ?? "Request sent.");
    });
  }

  return (
    <SettingsSection
      title="Delete account"
      description="An administrator removes your account and personal details. Your posts can be kept as anonymous or removed."
    >
      {requested ? (
        <FormMessage tone="info">
          Your deletion request is with an administrator. You&apos;ll get an email when it&apos;s
          done.
        </FormMessage>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <Trash2 data-icon="inline-start" />
            Request account deletion
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your UniConnect account?</AlertDialogTitle>
              <AlertDialogDescription>
                An administrator will remove your account. This can&apos;t be undone once processed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field id="deleteReason" label="Why are you leaving?" optional>
              <TextArea
                id="deleteReason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={submit} disabled={pending}>
                Send request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </SettingsSection>
  );
}
