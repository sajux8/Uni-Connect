"use client";

import { Lock, Pencil, Trash2, Unlock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteOpportunity, setOpportunityStatus } from "@/server/actions/careers";

/** Edit, close, reopen or delete an opportunity (its department's coordinator, super admins). */
export function OpportunityActions({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: "open" | "closed";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/careers/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
        <Pencil data-icon="inline-start" /> Edit
      </Link>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setOpportunityStatus(id, status === "open" ? "closed" : "open");
            if (!result.ok) return void toast.error(result.error);
            toast.success(result.message ?? "Done.");
            router.refresh();
          })
        }
      >
        {status === "open" ? (
          <>
            <Lock data-icon="inline-start" /> Close
          </>
        ) : (
          <>
            <Unlock data-icon="inline-start" /> Reopen
          </>
        )}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(true)} aria-label={`Delete ${title}`}>
        <Trash2 data-icon="inline-start" /> Delete
      </Button>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete “${title}”?`}
        description="Students who saved it lose it too. To keep it visible but stop applications, close it instead."
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteOpportunity(id);
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message ?? "Deleted.");
          router.push("/careers");
          router.refresh();
        }}
      />
    </div>
  );
}
