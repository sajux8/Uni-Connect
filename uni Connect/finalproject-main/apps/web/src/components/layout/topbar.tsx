"use client";

import { Menu, Search } from "lucide-react";

import { CreateMenu } from "@/components/layout/create-menu";
import { iconCircle } from "@/components/layout/icon-circle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useModKey } from "@/hooks/use-mod-key";
import type { ShellUser } from "@/components/layout/shell-user";
import { cn } from "@/lib/utils";

export function Topbar({
  user,
  unreadNotifications,
  menuDot = false,
  canPublish,
  onOpenMenu,
  onOpenSearch,
}: {
  user: ShellUser;
  unreadNotifications: number;
  /** Something unread lives in the navigation menu (e.g. announcements). */
  menuDot?: boolean;
  canPublish: boolean;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const mod = useModKey();

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-[14px] sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="relative md:hidden"
        onClick={onOpenMenu}
        aria-label={menuDot ? "Open navigation menu (new announcements)" : "Open navigation menu"}
      >
        <Menu />
        {menuDot && (
          <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-brand-cyan" />
        )}
      </Button>
      <Logo href="/home" iconOnly className="md:hidden" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="group ml-1 hidden h-11 w-full max-w-md items-center gap-2.5 rounded-full border-[1.5px] border-border bg-surface-tint px-4 text-sm font-medium text-muted-foreground transition-[border-color,box-shadow] outline-none hover:border-border-strong hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/40 sm:flex"
        aria-label="Search or ask"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate text-left">Search or ask…</span>
        <kbd className="pointer-events-none rounded-full border bg-card px-2 py-1 font-sans text-[11px] leading-none font-semibold">
          {mod} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          className={cn(iconCircle, "sm:hidden")}
          onClick={onOpenSearch}
          aria-label="Search or ask"
        >
          <Search className="size-[18px]" aria-hidden />
        </button>
        <CreateMenu canPublish={canPublish} />
        <NotificationBell userId={user.id} initialCount={unreadNotifications} />
        <ThemeSwitch />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
