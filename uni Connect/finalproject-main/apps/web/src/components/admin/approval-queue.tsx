"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput, TextArea } from "@/components/forms/field";
import { CategoryChip } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_LABELS, type UserRole } from "@/lib/campus";
import { parseStudentId } from "@/lib/student-id";
import {
  approveAccount,
  approveAccounts,
  rejectAccount,
  type BatchChoice,
} from "@/server/actions/admin";

export interface Application {
  id: string;
  fullName: string;
  email: string;
  requestedRole: "student" | "staff";
  departmentId: string | null;
  departmentName: string | null;
  idNumber: string | null;
  note: string | null;
  createdAt: string;
}

export interface BatchOption {
  id: string;
  departmentId: string;
  number: number;
  name: string;
}

export function ApprovalQueue({
  applications,
  batches,
  roles,
}: {
  applications: Application[];
  batches: BatchOption[];
  /** Roles this reviewer may grant (coordinators: student and lecturer). */
  roles: UserRole[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const allSelected = applications.length > 0 && selected.length === applications.length;

  function bulkApprove() {
    startTransition(async () => {
      const result = await approveAccounts(selected);
      if (result.ok) {
        toast.success(result.message ?? "Approved.");
        setSelected([]);
      } else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-soft">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-[18px] accent-primary"
            checked={allSelected}
            onChange={(event) =>
              setSelected(event.target.checked ? applications.map((a) => a.id) : [])
            }
          />
          {selected.length > 0 ? `${selected.length} selected` : "Select all"}
        </label>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button size="sm" disabled={selected.length === 0 || pending} />}
          >
            <CheckCheck data-icon="inline-start" />
            Approve selected
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Approve {selected.length} account{selected.length === 1 ? "" : "s"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                They&apos;ll join as students. Use the individual Approve button to grant a staff
                role.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={bulkApprove}>Approve</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ul className="space-y-3">
        {applications.map((application) => (
          <li key={application.id}>
            <ApplicationCard
              application={application}
              batches={batches}
              roles={roles}
              selected={selected.includes(application.id)}
              onSelect={(checked) =>
                setSelected((ids) =>
                  checked ? [...ids, application.id] : ids.filter((id) => id !== application.id),
                )
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplicationCard({
  application: a,
  batches,
  roles,
  selected,
  onSelect,
}: {
  application: Application;
  batches: BatchOption[];
  roles: UserRole[];
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const [role, setRole] = useState<UserRole>(a.requestedRole === "staff" ? "lecturer" : "student");
  const intake = parseStudentId(a.idNumber)?.intake;
  const departmentBatches = batches.filter((b) => b.departmentId === a.departmentId);
  const suggested = departmentBatches.find((b) => b.number === intake);
  const canCreate = intake !== undefined && !suggested && a.departmentId !== null;
  const [batch, setBatch] = useState<string>(suggested?.id ?? (canCreate ? "new" : ""));
  const [pending, startTransition] = useTransition();

  function approve() {
    const choice: BatchChoice =
      role !== "student" || !batch
        ? null
        : batch === "new"
          ? { departmentId: a.departmentId!, createNumber: intake! }
          : { id: batch };
    startTransition(async () => {
      const result = await approveAccount(a.id, role, choice);
      if (result.ok) toast.success(`${a.fullName} approved as ${ROLE_LABELS[role].toLowerCase()}.`);
      else toast.error(result.error);
    });
  }

  const details = [
    { label: "Email", value: a.email },
    { label: "Department", value: a.departmentName ?? "Not set" },
    ...(a.requestedRole === "student"
      ? [{ label: "Batch from ID", value: intake ? `Batch ${intake}` : "Not recognised" }]
      : []),
    {
      label: a.requestedRole === "staff" ? "Staff ID" : "Student ID",
      value: a.idNumber ?? "Not given",
    },
  ];

  return (
    <article
      aria-label={`Application from ${a.fullName}`}
      className="rounded-[22px] border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift sm:p-6"
    >
      <div className="flex gap-4">
        <label className="-m-2.5 mt-0.5 grid size-11 shrink-0 cursor-pointer place-items-center">
          <input
            type="checkbox"
            className="size-[18px] accent-primary"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            aria-label={`Select ${a.fullName}`}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-4">
          <header className="flex flex-wrap items-center gap-3">
            <UserAvatar name={a.fullName} size="md" />
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-extrabold">{a.fullName}</h3>
              <p className="text-xs text-muted-foreground">
                Applied {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
              </p>
            </div>
            <CategoryChip
              tint={a.requestedRole === "staff" ? "indigo" : "blue"}
              className="ml-auto"
            >
              {a.requestedRole === "staff" ? "Staff" : "Student"}
            </CategoryChip>
          </header>

          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 xl:grid-cols-4">
            {details.map((d) => (
              <div key={d.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{d.label}</dt>
                <dd className="truncate font-semibold" title={d.value}>
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>

          {a.note && (
            <p className="rounded-xl bg-surface-tint px-3.5 py-2.5 text-sm">
              <span className="font-semibold">Note: </span>
              {a.note}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="w-44">
              <label
                htmlFor={`role-${a.id}`}
                className="mb-1 block text-xs font-bold text-muted-foreground"
              >
                Approve as
              </label>
              <SelectInput
                id={`role-${a.id}`}
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="h-10"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </SelectInput>
            </div>
            {role === "student" && (
              <div className="w-60">
                <label
                  htmlFor={`batch-${a.id}`}
                  className="mb-1 block text-xs font-bold text-muted-foreground"
                >
                  Batch
                </label>
                <SelectInput
                  id={`batch-${a.id}`}
                  value={batch}
                  onChange={(event) => setBatch(event.target.value)}
                  className="h-10"
                >
                  <option value="">No batch yet</option>
                  {canCreate && (
                    <option value="new">
                      Create {a.departmentName} Batch {intake}
                    </option>
                  )}
                  {departmentBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
            <Button onClick={approve} disabled={pending}>
              <Check data-icon="inline-start" />
              {pending ? "Approving…" : "Approve"}
            </Button>
            <RejectDialog application={a} disabled={pending} />
          </div>
        </div>
      </div>
    </article>
  );
}

function RejectDialog({ application, disabled }: { application: Application; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = `reason-${application.id}`;

  function submit() {
    startTransition(async () => {
      const result = await rejectAccount(application.id, reason);
      if (!result.ok) {
        setError(result.fieldErrors?.reason?.[0] ?? result.error);
        return;
      }
      toast.success(`${application.fullName}'s application was rejected.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <X data-icon="inline-start" />
        Reject
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {application.fullName}&apos;s application?</DialogTitle>
          <DialogDescription>
            They&apos;ll see this reason when they log in. Keep it clear and respectful.
          </DialogDescription>
        </DialogHeader>
        <Field id={id} label="Reason" error={error}>
          <TextArea
            id={id}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            rows={3}
            maxLength={500}
            placeholder="e.g. We couldn't match this student ID to our records."
            {...describedBy(id, error)}
          />
        </Field>
        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Rejecting…" : "Reject application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
