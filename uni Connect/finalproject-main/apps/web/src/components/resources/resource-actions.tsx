"use client";

import { Check, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction, ReasonDialog } from "@/components/community/confirm-dialogs";
import { Button } from "@/components/ui/button";
import { deleteResource, reviewResource } from "@/server/actions/resources";

/** Approve / Reject (with a reason) for moderators. */
export function ResourceReviewButtons({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        aria-label={`Approve ${title}`}
        onClick={() =>
          startTransition(async () => {
            const result = await reviewResource(id, true);
            if (result.ok) {
              toast.success(result.message ?? "Approved.");
              router.refresh();
            } else toast.error(result.error);
          })
        }
      >
        <Check data-icon="inline-start" /> Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Reject ${title}`}
        onClick={() => setRejectOpen(true)}
      >
        <X data-icon="inline-start" /> Reject
      </Button>
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this resource?"
        description="The uploader sees your reason, so they can fix it and try again."
        confirmLabel="Reject"
        onConfirm={async (reason) => {
          const result = await reviewResource(id, false, reason);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.message ?? "Rejected.");
          router.refresh();
          return true;
        }}
      />
    </div>
  );
}

/** Delete your own resource (or any, for moderators). */
export function DeleteResourceButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-destructive">
        <Trash2 data-icon="inline-start" /> Delete
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title="Delete this resource?"
        description="The file and its details are removed for everyone. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteResource(id);
          if (result.ok) {
            toast.success(result.message ?? "Deleted.");
            router.push("/resources?mine=1");
          } else toast.error(result.error);
        }}
      />
    </>
  );
}
