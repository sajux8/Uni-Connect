"use client";

import Link from "next/link";
import {
  CalendarPlus,
  ChevronDown,
  CircleHelp,
  Megaphone,
  MessageSquarePlus,
  Plus,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The global "Create" menu. Staff-only items are shown to staff. */
export function CreateMenu({ canPublish }: { canPublish: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="hidden sm:inline-flex" />}>
        <Plus data-icon="inline-start" />
        Create
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Community</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href="/posts/new" />}>
            <MessageSquarePlus /> New discussion
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/posts/new?type=question" />}>
            <CircleHelp /> Ask a question
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/resources/new" />}>
            <Upload /> Share a resource
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/events/new" />}>
            <CalendarPlus /> New event
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {canPublish && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Official</DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/announcements/new" />}>
                <Megaphone /> New announcement
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
