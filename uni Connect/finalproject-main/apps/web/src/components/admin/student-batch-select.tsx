"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput } from "@/components/forms/field";
import { assignStudentBatch } from "@/server/actions/batches";

/** Move a student between batches of their department (saved on change). */
export function StudentBatchSelect({
  userId,
  batchId,
  batches,
}: {
  userId: string;
  batchId: string | null;
  batches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Field id="batch" label="Batch" hint="Moving a student also moves them between batch spaces.">
      <SelectInput
        id="batch"
        value={batchId ?? ""}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value || null;
          startTransition(async () => {
            const result = await assignStudentBatch(userId, next);
            if (result.ok) {
              toast.success(result.message ?? "Saved.");
              router.refresh();
            } else toast.error(result.error);
          });
        }}
        {...describedBy("batch", undefined, true)}
      >
        <option value="">No batch</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}
