"use client";

import Link from "next/link";
import { LogOut, MessageSquare, Settings, ShieldCheck, User } from "lucide-react";

import { RoleBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iconCircle } from "@/components/layout/icon-circle";
import type { ShellUser } from "@/components/layout/shell-user";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/auth";

export function UserMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className={cn(iconCircle, "overflow-hidden")}>
        <UserAvatar name={user.name} src={user.avatarUrl} size="md" className="size-full" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
            <UserAvatar name={user.name} src={user.avatarUrl} size="md" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                {user.role !== "student" && <RoleBadge role={user.role} />}
              </span>
              <span className="block truncate text-xs font-normal">{user.subtitle}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/u/${user.username}`} />}>
          <User /> Your profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/messages" />}>
          <MessageSquare /> Messages
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/profile" />}>
          <Settings /> Settings
        </DropdownMenuItem>
        {user.role !== "student" && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck /> Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
