"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublishStatus } from "@/lib/announcements";
import type { ActionResult } from "@/lib/action-result";
import {
  deleteAnnouncement,
  markAnnouncementRead,
  setAnnouncementArchived,
  setAnnouncementPinned,
} from "@/server/actions/announcements";

/** Publisher/admin menu on an announcement: edit, pin, archive, delete. */
export function AnnouncementActions({
  id,
  status,
  isPinned,
  canDelete,
  afterDelete = "/admin/announcements",
}: {
  id: string;
  status: PublishStatus;
  isPinned: boolean;
  canDelete: boolean;
  afterDelete?: string;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Announcement actions"
              disabled={pending}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem render={<Link href={`/announcements/${id}/edit`} />}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {status === "published" && (
            <DropdownMenuItem onClick={() => run(() => setAnnouncementPinned(id, !isPinned))}>
              {isPinned ? <PinOff /> : <Pin />} {isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
          )}
          {status === "published" && (
            <DropdownMenuItem onClick={() => run(() => setAnnouncementArchived(id, true))}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          {status === "archived" && (
            <DropdownMenuItem onClick={() => run(() => setAnnouncementArchived(id, false))}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this announcement?"
        description="It will be removed for everyone. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteAnnouncement(id);
          if (result.ok) {
            toast.success(result.message ?? "Deleted.");
            router.push(afterDelete);
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

/** Records that the viewer opened a published announcement (clears badges and its notification). */
export function MarkAnnouncementRead({ id }: { id: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markAnnouncementRead(id);
  }, [id]);
  return null;
}
