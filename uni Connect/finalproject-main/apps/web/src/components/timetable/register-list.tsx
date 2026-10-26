"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, TextArea } from "@/components/forms/field";
import { CategoryChip } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCampus } from "@/lib/campus-time";
import { correctAttendance } from "@/server/actions/timetable";
import type { RegisterRow } from "@/server/queries/timetable";

const SOURCE_LABELS = {
  self: "Marked by themselves",
  lecturer: "By the lecturer",
  coordinator: "By the coordinator",
};

/**
 * A class's register for its lecturer and the coordinator. Corrections need a reason; they're
 * logged and the student is told (Phase D).
 */
export function RegisterList({
  sessionId,
  rows,
  editable,
}: {
  sessionId: string;
  rows: RegisterRow[];
  /** False before the class starts or once it's cancelled. */
  editable: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<RegisterRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function open(row: RegisterRow) {
    setTarget(row);
    setReason("");
    setError(undefined);
  }

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const result = await correctAttendance({
        sessionId,
        studentId: target.id,
        present: !target.present,
        reason,
      });
      if (!result.ok) {
        setError(result.fieldErrors?.reason?.[0] ?? result.error);
        return;
      }
      toast.success(result.message ?? "Updated.");
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
            <UserAvatar name={row.name} src={row.avatarUrl} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/u/${row.username}`}
                className="block truncate text-sm font-bold hover:text-primary"
              >
                {row.name}
              </Link>
              {row.present && row.source && (
                <p className="text-xs text-muted-foreground">
                  {SOURCE_LABELS[row.source]}
                  {row.markedAt ? ` · ${formatCampus(row.markedAt, "time")}` : ""}
                </p>
              )}
            </div>
            {row.present ? (
              <CategoryChip tint="emerald">Present</CategoryChip>
            ) : (
              <CategoryChip tint="zinc">Not marked</CategoryChip>
            )}
            {editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => open(row)}
                aria-label={`${row.present ? "Mark absent" : "Mark present"}: ${row.name}`}
              >
                {row.present ? "Mark absent" : "Mark present"}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark {target?.name} {target?.present ? "absent" : "present"}?
            </DialogTitle>
            <DialogDescription>
              Corrections are logged with your reason, and the student is told.
            </DialogDescription>
          </DialogHeader>
          <Field id="correctionReason" label="Reason" error={error}>
            <TextArea
              id="correctionReason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(undefined);
              }}
              placeholder={
                target?.present
                  ? "e.g. Left after the first ten minutes."
                  : "e.g. Was in class; their phone battery was dead."
              }
              {...describedBy("correctionReason", error)}
            />
          </Field>
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
