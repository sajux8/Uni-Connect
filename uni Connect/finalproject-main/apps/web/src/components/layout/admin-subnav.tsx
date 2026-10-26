"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/lib/campus";
import { adminNavFor, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Horizontal tab row for the admin area (scrolls on small screens). */
export function AdminSubNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = adminNavFor(role);

  return (
    <nav
      aria-label="Admin"
      className="-mx-4 mb-6 [scrollbar-width:none] overflow-x-auto border-b px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center px-3 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground",
                  active &&
                    "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
