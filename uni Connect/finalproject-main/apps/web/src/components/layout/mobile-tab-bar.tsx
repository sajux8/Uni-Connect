"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import type { ShellBadges } from "@/components/layout/shell-user";
import { buttonVariants } from "@/components/ui/button";
import { MOBILE_TABS, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Bottom tab bar + floating Create button, shown below the `md` breakpoint. */
export function MobileTabBar({ badges = {} }: { badges?: ShellBadges }) {
  const pathname = usePathname();
  // The floating "+" would cover the form (and its submit button) on create, edit and settings pages.
  // Hidden where it would cover a form's buttons, the chat composer or the Ask AI box.
  const showCreate =
    !/\/(new|edit)$/.test(pathname) &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/messages/") &&
    !pathname.startsWith("/forms/") &&
    !pathname.startsWith("/support/") &&
    pathname !== "/ask";

  return (
    <>
      {showCreate && (
        <Link
          href="/posts/new"
          aria-label="Create a post"
          className={cn(
            buttonVariants({ size: "icon-lg" }),
            "fixed right-4 bottom-[4.5rem] z-30 size-12 rounded-full shadow-lg md:hidden",
          )}
        >
          <Plus className="size-5" />
        </Link>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            const badge = tab.badgeKey ? (badges[tab.badgeKey] ?? 0) : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={badge > 0 ? `${tab.label}, ${badge} unread` : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors outline-none focus-visible:bg-accent",
                    active && "text-primary",
                  )}
                >
                  <span className="relative">
                    <tab.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                    {badge > 0 && (
                      <span
                        aria-hidden
                        className="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
