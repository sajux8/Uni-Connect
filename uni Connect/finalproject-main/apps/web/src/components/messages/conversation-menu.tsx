"use client";

import { Ban, Flag, MoreHorizontal, Unlink, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EndMentorshipDialog } from "@/components/mentorship/request-actions";
import { BlockUserDialog } from "@/components/profile/block-user-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** ⋯ menu in the chat header: View profile, End mentorship, Block. */
export function ConversationMenu({
  partner,
  requestId,
  active,
  blockedByMe,
}: {
  partner: { id: string; name: string; username: string | null };
  requestId: string;
  active: boolean;
  blockedByMe: boolean;
}) {
  const [endOpen, setEndOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Conversation options" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {partner.username && (
            <DropdownMenuItem render={<Link href={`/u/${partner.username}`} />}>
              <User /> View profile
            </DropdownMenuItem>
          )}
          {active && (
            <DropdownMenuItem onClick={() => setEndOpen(true)}>
              <Unlink /> End mentorship
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setReportOpen(true)}>
            <Flag /> Report {partner.name.split(" ")[0]}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant={blockedByMe ? "default" : "destructive"}
            onClick={() => setBlockOpen(true)}
          >
            {blockedByMe ? <UserCheck /> : <Ban />} {blockedByMe ? "Unblock" : "Block"}{" "}
            {partner.name.split(" ")[0]}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EndMentorshipDialog
        requestId={requestId}
        otherName={partner.name}
        open={endOpen}
        onOpenChange={setEndOpen}
      />
      <ReportDialog
        targetType="user"
        targetId={partner.id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
      <BlockUserDialog
        userId={partner.id}
        name={partner.name}
        blocked={blockedByMe}
        open={blockOpen}
        onOpenChange={setBlockOpen}
      />
    </>
  );
}
