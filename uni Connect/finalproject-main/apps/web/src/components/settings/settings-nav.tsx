"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/mentor", label: "Mentoring" },
] as const;

/** Pill tabs shared by every settings page. */
export function SettingsNav() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // On narrow screens the tabs scroll sideways: keep the current one in view.
  useEffect(() => {
    const active = nav.current?.querySelector<HTMLElement>("[aria-current=page]");
    if (active && nav.current) {
      nav.current.scrollLeft =
        active.offsetLeft - nav.current.clientWidth / 2 + active.clientWidth / 2;
    }
  }, [pathname]);
  return (
    <nav
      ref={nav}
      aria-label="Settings"
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-primary ring-1 ring-primary/20 ring-inset dark:text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
