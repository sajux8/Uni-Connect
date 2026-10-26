"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { DECISION_INFO, hideLabel, type ReportDecision, type ReportTarget } from "@/lib/moderation";
import { cn } from "@/lib/utils";
import { moderateReport } from "@/server/actions/reports";

/** Choose what to do about a report; a note is always required (Feature 12 §2). */
export function ReportDecisionForm({
  reportId,
  targetType,
  decisions,
  related,
}: {
  reportId: string;
  targetType: ReportTarget;
  decisions: ReportDecision[];
  /** Other open reports on the same thing (they're resolved together). */
  related: number;
}) {
  const router = useRouter();
  const [action, setAction] = useState<ReportDecision | "">("");
  const [note, setNote] = useState("");
  const [until, setUntil] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) {
      setErrors({ action: "Choose what to do." });
      return;
    }
    startTransition(async () => {
      const result = await moderateReport({
        reportId,
        action,
        note,
        until: action === "suspend" ? until : undefined,
      });
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset
        className="space-y-2"
        aria-describedby={errors.action ? "decision-error" : undefined}
      >
        <legend className="mb-1 text-[13.5px] font-bold">Decision</legend>
        {decisions.map((d) => (
          <label
            key={d}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent",
              action === d && "border-primary bg-accent",
            )}
          >
            <input
              type="radio"
              name="decision"
              value={d}
              checked={action === d}
              onChange={() => {
                setAction(d);
                setErrors({});
              }}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {d === "hide" ? hideLabel(targetType) : DECISION_INFO[d].label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {DECISION_INFO[d].description}
              </span>
            </span>
          </label>
        ))}
        {errors.action && (
          <p id="decision-error" role="alert" className="text-[13px] font-medium text-destructive">
            {errors.action}
          </p>
        )}
      </fieldset>
      {action === "suspend" && (
        <Field
          id="suspend-until"
          label="Suspended until"
          optional
          error={errors.until}
          hint="Leave empty to suspend until an admin reinstates them."
        >
          <TextInput
            id="suspend-until"
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            {...describedBy("suspend-until", errors.until, true)}
          />
        </Field>
      )}
      <Field
        id="decision-note"
        label="Note"
        error={errors.note}
        hint={
          action === "warn" || action === "suspend" || action === "hide" || action === "remove"
            ? "The author sees this note. Keep it clear and respectful."
            : "Recorded in the moderation log."
        }
      >
        <TextArea
          id="decision-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={3}
          {...describedBy("decision-note", errors.note, true)}
        />
      </Field>
      {related > 0 && (
        <p className="text-sm text-muted-foreground">
          This also resolves {related} other open {related === 1 ? "report" : "reports"} about the
          same thing.
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        variant={action && DECISION_INFO[action].destructive ? "destructive" : "default"}
      >
        {pending ? "Saving…" : "Confirm decision"}
      </Button>
    </form>
  );
}
