"use client";

import { Ban, Copy, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction, ReasonDialog } from "@/components/community/confirm-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EventStatus } from "@/lib/events";
import { cancelEvent, deleteEvent } from "@/server/actions/events";

/** Organizer/admin menu on an event (Edit, Attendees, Cancel, Duplicate). */
export function EventActions({
  id,
  status,
  isDraft,
  registeredCount,
}: {
  id: string;
  status: EventStatus;
  /** Never published, so it can be deleted. */
  isDraft: boolean;
  registeredCount: number;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="Event actions" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status !== "cancelled" && (
            <DropdownMenuItem render={<Link href={`/events/${id}/edit`} />}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link href={`/events/${id}/attendees`} />}>
            <Users /> Attendees ({registeredCount})
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/events/new?from=${id}`} />}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          {status === "published" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban /> Cancel event
              </DropdownMenuItem>
            </>
          )}
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete draft
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this event?"
        description="Everyone registered or on the waitlist is told straight away, with your reason. This can't be undone."
        confirmLabel="Cancel event"
        onConfirm={async (reason) => {
          const result = await cancelEvent(id, reason);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.message ?? "Event cancelled.");
          router.refresh();
          return true;
        }}
      />
      <ConfirmAction
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this draft?"
        description="It was never published, so nobody else has seen it. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteEvent(id);
          if (result.ok) {
            toast.success(result.message ?? "Deleted.");
            router.push("/events/mine?tab=organizing");
          } else toast.error(result.error);
        }}
      />
    </>
  );
}
