"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, TextArea } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportTarget,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";
import { reportContent } from "@/server/actions/reports";

/**
 * Report something to the moderators.
 * Controlled, so menus can open it; `ReportButton` below is the stand-alone version.
 */
export function ReportDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: {
  targetType: ReportTarget;
  targetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();
  const what = REPORT_TARGET_LABELS[targetType].toLowerCase();
  const detailsId = `report-details-${targetId}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setErrors({ reason: "Choose a reason." });
      return;
    }
    startTransition(async () => {
      const result = await reportContent({ targetType, targetId, reason, details });
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Thanks. Moderators will review this.");
      setReason("");
      setDetails("");
      setErrors({});
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Report this {what}</DialogTitle>
            <DialogDescription>
              Moderators will review it. The person you report isn&apos;t told who reported them.
              {targetType === "message" &&
                " A copy of this message is shared with the moderators so they can review it."}
            </DialogDescription>
          </DialogHeader>
          <fieldset
            className="space-y-2"
            aria-describedby={errors.reason ? "report-reason-error" : undefined}
          >
            <legend className="mb-1 text-[13.5px] font-bold">What&apos;s wrong?</legend>
            <div className="grid max-h-[40vh] gap-1.5 overflow-y-auto pr-1">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent",
                    reason === r.value && "border-primary bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => {
                      setReason(r.value);
                      setErrors({});
                    }}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.reason && (
              <p
                id="report-reason-error"
                role="alert"
                className="text-[13px] font-medium text-destructive"
              >
                {errors.reason}
              </p>
            )}
          </fieldset>
          <Field
            id={detailsId}
            label="Details"
            optional={reason !== "other"}
            error={errors.details}
            hint="Anything that helps the moderators understand the problem."
          >
            <TextArea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              {...describedBy(detailsId, errors.details, true)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              <Flag data-icon="inline-start" />
              {pending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A small "Report" button that opens the dialog. */
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
  className,
}: {
  targetType: ReportTarget;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("text-muted-foreground", className)}
      >
        <Flag data-icon="inline-start" /> {label}
      </Button>
      <ReportDialog
        targetType={targetType}
        targetId={targetId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
