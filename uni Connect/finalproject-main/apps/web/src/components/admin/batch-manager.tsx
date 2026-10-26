"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Field, SelectInput, TextInput } from "@/components/forms/field";
import { RoleBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { createBatch, setBatchLecturer, setBatchRep } from "@/server/actions/batches";
import type { BatchSummary, PersonRef } from "@/server/queries/batches";

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult<unknown>>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      onDone?.();
      router.refresh();
    });
  }
  return { pending, run };
}

/** "Create Computing Batch 18": a number is all it takes; the batch space is created with it. */
export function NewBatchForm({
  departmentId,
  departmentName,
}: {
  departmentId: string;
  departmentName: string;
}) {
  const [number, setNumber] = useState("");
  const { pending, run } = useRun();
  const n = Number(number);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          run(
            () => createBatch(departmentId, n),
            () => setNumber(""),
          );
      }}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-[22px] border bg-card p-4 shadow-soft sm:p-5"
    >
      <Field
        id="batch-number"
        label="New batch number"
        hint={
          valid
            ? `Creates “${departmentName} Batch ${n}” and its private space.`
            : "The intake number from student IDs, e.g. 17."
        }
        className="min-w-56 flex-1"
      >
        <TextInput
          id="batch-number"
          inputMode="numeric"
          value={number}
          onChange={(event) => setNumber(event.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="e.g. 18"
          aria-describedby="batch-number-hint"
        />
      </Field>
      <Button type="submit" disabled={!valid || pending}>
        <Plus data-icon="inline-start" /> Create batch
      </Button>
    </form>
  );
}

function PersonLine({ person, children }: { person: PersonRef; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <UserAvatar name={person.name} src={person.avatarUrl} size="xs" />
      <Link
        href={`/admin/users/${person.id}`}
        className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary"
      >
        {person.name}
      </Link>
      {children}
    </li>
  );
}

export function BatchCard({ batch, lecturers }: { batch: BatchSummary; lecturers: PersonRef[] }) {
  const { pending, run } = useRun();
  const assigned = new Set(batch.lecturers.map((l) => l.id));
  const available = lecturers.filter((l) => !assigned.has(l.id));
  const students = batch.students.length;

  return (
    <article
      aria-labelledby={`batch-${batch.id}`}
      className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-6"
    >
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={`batch-${batch.id}`} className="text-[18px] font-extrabold tracking-tight">
            {batch.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {students} {students === 1 ? "student" : "students"} · {batch.lecturers.length}{" "}
            {batch.lecturers.length === 1 ? "lecturer" : "lecturers"}
          </p>
        </div>
        {batch.spaceSlug && (
          <Link
            href={`/spaces/${batch.spaceSlug}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink data-icon="inline-start" /> Open space
          </Link>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-label="Class rep" className="space-y-2">
          <Field
            id={`rep-${batch.id}`}
            label="Class rep"
            hint="Highlighted in gold. They can post batch announcements and moderate the batch."
          >
            <SelectInput
              id={`rep-${batch.id}`}
              value={batch.rep?.id ?? ""}
              disabled={pending || students === 0}
              onChange={(event) => run(() => setBatchRep(batch.id, event.target.value || null))}
              className="h-10"
              aria-describedby={`rep-${batch.id}-hint`}
            >
              <option value="">{students === 0 ? "No students yet" : "No class rep"}</option>
              {batch.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </section>

        <section aria-labelledby={`lecturers-${batch.id}`} className="space-y-2">
          <h3 id={`lecturers-${batch.id}`} className="text-sm font-bold">
            Lecturers
          </h3>
          {batch.lecturers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lecturers assigned yet.</p>
          ) : (
            <ul className="divide-y">
              {batch.lecturers.map((l) => (
                <PersonLine key={l.id} person={l}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={pending}
                    onClick={() => run(() => setBatchLecturer(batch.id, l.id, false))}
                    aria-label={`Remove ${l.name} from ${batch.name}`}
                  >
                    <X />
                  </Button>
                </PersonLine>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <SelectInput
              aria-label={`Add a lecturer to ${batch.name}`}
              value=""
              disabled={pending}
              onChange={(event) =>
                event.target.value &&
                run(() => setBatchLecturer(batch.id, event.target.value, true))
              }
              className="h-10"
            >
              <option value="">Add a lecturer…</option>
              {available.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectInput>
          )}
        </section>

        <section aria-labelledby={`students-${batch.id}`} className="space-y-2">
          <h3 id={`students-${batch.id}`} className="text-sm font-bold">
            Students
          </h3>
          {students === 0 ? (
            <p className="text-sm text-muted-foreground">
              Approve students into this batch from Approvals, or move them from their account page.
            </p>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto pr-1">
              {batch.students.map((s) => (
                <PersonLine key={s.id} person={s}>
                  {batch.rep?.id === s.id && <RoleBadge role="rep" />}
                </PersonLine>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
