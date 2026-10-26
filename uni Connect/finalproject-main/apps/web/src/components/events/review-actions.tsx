"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { reviewEvent } from "@/server/actions/events";

/** Approve (publishes it) or decline with a reason the organizer sees (Phase C). */
export function EventReviewActions({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await reviewEvent(eventId, approve, approve ? "" : note);
      if (!result.ok) {
        if (approve) toast.error(result.error);
        else setError(result.fieldErrors?.note?.[0] ?? result.error);
        return;
      }
      toast.success(result.message ?? "Done.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => decide(true)} disabled={pending} aria-label={`Approve ${title}`}>
        <Check data-icon="inline-start" /> Approve
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button variant="outline" disabled={pending} aria-label={`Decline ${title}`} />}
        >
          <X data-icon="inline-start" /> Decline
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline “{title}”?</DialogTitle>
            <DialogDescription>
              The organizer sees your reason and can edit the event and submit it again.
            </DialogDescription>
          </DialogHeader>
          <Field id={`decline-${eventId}`} label="Reason" error={error}>
            <TextArea
              id={`decline-${eventId}`}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setError(undefined);
              }}
              rows={3}
              maxLength={500}
              placeholder="e.g. The hall is booked that evening. Could you pick another date?"
              {...describedBy(`decline-${eventId}`, error)}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => decide(false)} disabled={pending}>
              Decline event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
