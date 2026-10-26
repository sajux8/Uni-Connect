"use client";

import { Ban, Flag, MoreHorizontal, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, unblockUser } from "@/server/actions/profile";

/** Confirm, then block or unblock someone (Feature 4 / O9). */
export function BlockUserDialog({
  userId,
  name,
  blocked,
  open,
  onOpenChange,
}: {
  userId: string;
  name: string;
  blocked: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const first = name.split(" ")[0];
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title={blocked ? `Unblock ${first}?` : `Block ${first}?`}
      description={
        blocked
          ? `${first} will be able to send you mentorship requests again. Past mentorships stay closed.`
          : `${first} won't be able to message you or send you mentorship requests, and any mentorship between you ends. They aren't told that you blocked them.`
      }
      confirmLabel={blocked ? "Unblock" : "Block"}
      onConfirm={async () => {
        const result = blocked ? await unblockUser(userId) : await blockUser(userId);
        if (result.ok) {
          toast.success(result.message ?? "Done.");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}

/** "⋯" menu on someone else's profile. */
export function ProfileMenu({
  userId,
  name,
  blocked,
}: {
  userId: string;
  name: string;
  blocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="More options" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setReportOpen(true)}>
            <Flag /> Report
          </DropdownMenuItem>
          <DropdownMenuItem
            variant={blocked ? "default" : "destructive"}
            onClick={() => setOpen(true)}
          >
            {blocked ? <UserCheck /> : <Ban />} {blocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlockUserDialog
        userId={userId}
        name={name}
        blocked={blocked}
        open={open}
        onOpenChange={setOpen}
      />
      <ReportDialog
        targetType="user"
        targetId={userId}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}

/** Unblock button in Settings → Privacy. */
export function UnblockButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Unblock ${name}`}
      >
        Unblock
      </Button>
      <BlockUserDialog userId={userId} name={name} blocked open={open} onOpenChange={setOpen} />
    </>
  );
}
