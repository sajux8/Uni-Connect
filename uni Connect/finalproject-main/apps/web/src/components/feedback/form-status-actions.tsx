"use client";

import { Lock, Pencil, Send, Trash2, Unlock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FormStatus } from "@/lib/forms";
import { deleteForm, setFormStatus } from "@/server/actions/forms";

/** Publish, close, reopen, edit or delete a form (its creator and the coordinator, Phase E). */
export function FormStatusActions({
  formId,
  title,
  status,
  answered,
}: {
  formId: string;
  title: string;
  /** The effective status: an open form past its closing time counts as closed. */
  status: FormStatus;
  answered: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function change(next: FormStatus) {
    startTransition(async () => {
      const result = await setFormStatus(formId, next);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Done.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/forms/${formId}/edit`} className={buttonVariants({ variant: "outline" })}>
        <Pencil data-icon="inline-start" /> Edit
      </Link>
      {status === "draft" && (
        <Button onClick={() => change("open")} disabled={pending}>
          <Send data-icon="inline-start" /> Publish
        </Button>
      )}
      {status === "open" && (
        <Button variant="outline" onClick={() => change("closed")} disabled={pending}>
          <Lock data-icon="inline-start" /> Close
        </Button>
      )}
      {status === "closed" && (
        <Button variant="outline" onClick={() => change("open")} disabled={pending}>
          <Unlock data-icon="inline-start" /> Reopen
        </Button>
      )}
      {status === "open" && !answered && (
        <Button variant="ghost" onClick={() => change("draft")} disabled={pending}>
          Back to draft
        </Button>
      )}
      <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${title}`}>
        <Trash2 data-icon="inline-start" /> Delete
      </Button>
      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${title}”?`}
        description={
          answered ? "Its answers are deleted too. This can't be undone." : "This can't be undone."
        }
        confirmLabel="Delete form"
        onConfirm={async () => {
          const result = await deleteForm(formId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message ?? "Deleted.");
          router.push("/forms");
          router.refresh();
        }}
      />
    </div>
  );
}
