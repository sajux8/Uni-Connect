"use client";

import { useState } from "react";

import { CommandSearch } from "@/components/layout/command-search";
import { CurrentSpaceProvider } from "@/components/layout/current-space";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { NavigationTracker } from "@/components/shared/back-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLocalStorageBoolean } from "@/hooks/use-local-storage";
import type { ShellBadges, ShellSpace, ShellUser } from "@/components/layout/shell-user";
import { cn } from "@/lib/utils";
import { roleAtLeast } from "@/lib/campus";

/**
 * The signed-in app frame:
 * sidebar (collapsible) · sticky top bar · main · mobile sheet + tab bar.
 *
 * The (app) layout resolves the session on the server and passes the user in.
 */
export function AppShell({
  user,
  spaces,
  badges = {},
  children,
}: {
  user: ShellUser;
  spaces: ShellSpace[];
  badges?: ShellBadges;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useLocalStorageBoolean("uniconnect:sidebar-collapsed", false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <CurrentSpaceProvider>
      <NavigationTracker />
      <div className="flex min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 border-r bg-sidebar transition-[width] duration-200 md:block",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <SidebarContent
            collapsed={collapsed}
            role={user.role}
            spaces={spaces}
            badges={badges}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
          />
        </aside>

        {/* Mobile navigation sheet */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-72 gap-0 bg-sidebar p-0 sm:max-w-72"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Browse UniConnect</SheetDescription>
            <SidebarContent
              role={user.role}
              spaces={spaces}
              badges={badges}
              onNavigate={() => setMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col bg-surface-tint">
          <Topbar
            user={user}
            unreadNotifications={badges.notifications ?? 0}
            menuDot={(badges.announcements ?? 0) + (badges.messages ?? 0) > 0}
            canPublish={roleAtLeast(user.role, "lecturer")}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 pb-28 outline-none sm:px-6 md:pb-12 lg:px-10"
          >
            {children}
          </main>
        </div>

        <MobileTabBar badges={badges} />
        <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} role={user.role} />
      </div>
    </CurrentSpaceProvider>
  );
}
