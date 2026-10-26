"use client";

import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_LABELS, type AccountStatus, type UserRole } from "@/lib/campus";
import {
  changeUserRole,
  decideDeletionRequest,
  reinstateUser,
  suspendUser,
} from "@/server/actions/admin";

/** Role select (saved on change, after confirming) for an active account. */
export function RoleSelect({
  userId,
  role,
  name,
  roles,
}: {
  userId: string;
  role: UserRole;
  name: string;
  /** Roles the viewer may grant (coordinators: student and lecturer). */
  roles: UserRole[];
}) {
  const router = useRouter();
  const [next, setNext] = useState<UserRole | null>(null);
  return (
    <>
      <Field
        id="role"
        label="Role"
        hint="Lecturers publish for their batches; coordinators run a department; super admins run everything."
      >
        <SelectInput
          id="role"
          value={role}
          onChange={(event) => setNext(event.target.value as UserRole)}
          {...describedBy("role", undefined, true)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <ConfirmAction
        open={next !== null}
        onOpenChange={(open) => !open && setNext(null)}
        title={`Make ${name.split(" ")[0]} ${next ? ROLE_LABELS[next].toLowerCase() : ""}?`}
        description={
          next === "super_admin"
            ? "Super admins can manage every department, account and setting."
            : next === "coordinator"
              ? "Coordinators approve students, manage batches and lecturers, and moderate their department."
              : next === "lecturer"
                ? "Lecturers can publish announcements and events, and moderate the batches they teach."
                : "They lose any staff permissions."
        }
        confirmLabel="Change role"
        onConfirm={async () => {
          if (!next) return;
          const result = await changeUserRole(userId, next);
          if (result.ok) {
            toast.success(result.message ?? "Role updated.");
            router.refresh();
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

export function StatusActions({
  userId,
  status,
  name,
}: {
  userId: string;
  status: AccountStatus;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const first = name.split(" ")[0];

  if (status === "suspended") {
    return (
      <>
        <Button variant="outline" onClick={() => setReinstateOpen(true)}>
          <RotateCcw data-icon="inline-start" /> Reinstate
        </Button>
        <ConfirmAction
          open={reinstateOpen}
          onOpenChange={setReinstateOpen}
          title={`Reinstate ${first}?`}
          description="They can sign in and use UniConnect again straight away."
          confirmLabel="Reinstate"
          onConfirm={async () => {
            const result = await reinstateUser(userId);
            if (result.ok) {
              toast.success(result.message ?? "Reinstated.");
              router.refresh();
            } else toast.error(result.error);
          }}
        />
      </>
    );
  }
  if (status !== "approved") return null;

  function submit() {
    startTransition(async () => {
      const result = await suspendUser(userId, reason, until || undefined);
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Suspended.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Ban data-icon="inline-start" /> Suspend
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {first}?</DialogTitle>
          <DialogDescription>
            They&apos;re signed out of everything and see your reason when they try to sign in.
          </DialogDescription>
        </DialogHeader>
        <Field id="suspend-reason" label="Reason" error={errors.reason}>
          <TextArea
            id="suspend-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            {...describedBy("suspend-reason", errors.reason)}
          />
        </Field>
        <Field
          id="suspend-until"
          label="Until"
          optional
          error={errors.until}
          hint="Leave empty to suspend until you reinstate them."
        >
          <TextInput
            id="suspend-until"
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            {...describedBy("suspend-until", errors.until, true)}
          />
        </Field>
        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Suspending…" : "Suspend account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeletionRequestActions({ requestId, name }: { requestId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"approve" | "decline" | null>(null);
  const first = name.split(" ")[0];
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="destructive" size="sm" onClick={() => setConfirm("approve")}>
        Delete account
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirm("decline")}>
        Decline
      </Button>
      <ConfirmAction
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "approve" ? `Delete ${first}'s account?` : "Decline this request?"}
        description={
          confirm === "approve"
            ? "Their profile, memberships, registrations, mentorships and messages are deleted. Posts they wrote stay, shown as from a former member. This can't be undone."
            : `${first}'s account stays as it is. Let them know why by email.`
        }
        confirmLabel={confirm === "approve" ? "Delete account" : "Decline request"}
        onConfirm={async () => {
          const result = await decideDeletionRequest(requestId, confirm === "approve");
          if (result.ok) {
            toast.success(result.message ?? "Done.");
            if (confirm === "approve") router.push("/admin/users");
            else router.refresh();
          } else toast.error(result.error);
        }}
      />
    </div>
  );
}
