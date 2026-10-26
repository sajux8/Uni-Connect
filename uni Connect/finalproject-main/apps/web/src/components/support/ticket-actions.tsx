"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput, TextArea } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { TICKET_STATUS, type TicketStatus } from "@/lib/support";
import { replyTicket, setTicketStatus } from "@/server/actions/support";

/** Reply on a ticket thread (owner or handler; never on anonymous complaints). */
export function TicketReply({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Field id="ticketReply" label="Reply" error={error}>
        <TextArea
          id="ticketReply"
          rows={3}
          maxLength={4000}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError(undefined);
          }}
          placeholder={staff ? "Reply to the student…" : "Add more details or answer a question…"}
          {...describedBy("ticketReply", error)}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await replyTicket(ticketId, body);
              if (!result.ok) return setError(result.fieldErrors?.body?.[0] ?? result.error);
              toast.success(result.message ?? "Sent.");
              setBody("");
              router.refresh();
            })
          }
        >
          <Send data-icon="inline-start" /> {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}

/** Handlers change the status, with an optional note the owner sees. */
export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const router = useRouter();
  const [next, setNext] = useState<TicketStatus>(status === "open" ? "in_progress" : status);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Field id="ticketStatus" label="Status">
        <SelectInput
          id="ticketStatus"
          value={next}
          onChange={(e) => setNext(e.target.value as TicketStatus)}
        >
          {(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS[s].label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="ticketNote" label="Note to the student" optional>
        <TextArea
          id="ticketNote"
          rows={2}
          maxLength={4000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Maintenance will fix the AC on Monday."
        />
      </Field>
      <Button
        className="w-full"
        disabled={pending || (next === status && !note.trim())}
        onClick={() =>
          startTransition(async () => {
            const result = await setTicketStatus(ticketId, next, note);
            if (!result.ok) return void toast.error(result.error);
            toast.success(result.message ?? "Updated.");
            setNote("");
            router.refresh();
          })
        }
      >
        {pending ? "Updating…" : "Update"}
      </Button>
    </div>
  );
}
