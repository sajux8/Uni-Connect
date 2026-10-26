"use client";

import { Check, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { describedBy, Field, TextArea } from "@/components/forms/field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelMentorshipRequest,
  endMentorship,
  respondToRequest,
} from "@/server/actions/mentorship";

/** Accept or decline, each with an optional note for the student. */
export function RespondButtons({
  requestId,
  menteeName,
}: {
  requestId: string;
  menteeName: string;
}) {
  const router = useRouter();
  const first = menteeName.split(" ")[0];
  return (
    <div className="flex flex-wrap gap-2">
      <NoteDialog
        trigger={
          <>
            <Check data-icon="inline-start" /> Accept
          </>
        }
        triggerLabel={`Accept ${menteeName}`}
        title={`Mentor ${first}?`}
        description="A private conversation opens and they're notified. Add a note to welcome them (optional)."
        confirmLabel="Accept and open chat"
        placeholder="e.g. Happy to help! Tell me which modules you're taking."
        onConfirm={async (note) => {
          const result = await respondToRequest(requestId, true, note);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.message ?? "Accepted.");
          if (result.data.conversationId) router.push(`/messages/${result.data.conversationId}`);
          else router.refresh();
          return true;
        }}
      />
      <NoteDialog
        variant="outline"
        trigger={
          <>
            <X data-icon="inline-start" /> Decline
          </>
        }
        triggerLabel={`Decline ${menteeName}`}
        title={`Decline ${first}'s request?`}
        description="They're told you can't take them on. A short, kind note helps (optional)."
        confirmLabel="Decline"
        placeholder="e.g. I'm full this term. Try asking someone who covers databases."
        onConfirm={async (note) => {
          const result = await respondToRequest(requestId, false, note);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.message ?? "Declined.");
          router.refresh();
          return true;
        }}
      />
    </div>
  );
}

function NoteDialog({
  trigger,
  triggerLabel,
  variant = "default",
  title,
  description,
  confirmLabel,
  placeholder,
  onConfirm,
}: {
  trigger: React.ReactNode;
  triggerLabel: string;
  variant?: "default" | "outline";
  title: string;
  description: string;
  confirmLabel: string;
  placeholder: string;
  onConfirm: (note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const id = `note-${triggerLabel.replace(/\W+/g, "-")}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={variant} aria-label={triggerLabel} />}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field id={id} label="Note" optional hint={`${note.length}/300 characters`}>
          <TextArea
            id={id}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder={placeholder}
            {...describedBy(id, undefined, true)}
          />
        </Field>
        <DialogFooter>
          <Button
            variant={variant === "outline" ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (await onConfirm(note.trim())) {
                  setNote("");
                  setOpen(false);
                }
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawButton({
  requestId,
  mentorName,
}: {
  requestId: string;
  mentorName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Withdraw request to ${mentorName}`}
      >
        Withdraw
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title="Withdraw this request?"
        description={`${mentorName.split(" ")[0]} won't see it any more. You can send a new one later.`}
        confirmLabel="Withdraw"
        onConfirm={async () => {
          const result = await cancelMentorshipRequest(requestId);
          if (result.ok) {
            toast.success(result.message ?? "Withdrawn.");
            router.refresh();
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

/** "End mentorship" (confirmed). Shared by the mentorship list and the chat menu. */
export function EndMentorshipDialog({
  requestId,
  otherName,
  open,
  onOpenChange,
}: {
  requestId: string;
  otherName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title="End this mentorship?"
      description={`${otherName.split(" ")[0]} is told. Neither of you can send new messages, but you can both still read the conversation.`}
      confirmLabel="End mentorship"
      onConfirm={async () => {
        const result = await endMentorship(requestId);
        if (result.ok) {
          toast.success(result.message ?? "Ended.");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}

export function ActiveMentorshipButtons({
  requestId,
  conversationId,
  otherName,
}: {
  requestId: string;
  conversationId: string | null;
  otherName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {conversationId && (
        <Link href={`/messages/${conversationId}`} className={buttonVariants({ size: "sm" })}>
          <MessageCircle data-icon="inline-start" /> Message
        </Link>
      )}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        End mentorship
      </Button>
      <EndMentorshipDialog
        requestId={requestId}
        otherName={otherName}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
