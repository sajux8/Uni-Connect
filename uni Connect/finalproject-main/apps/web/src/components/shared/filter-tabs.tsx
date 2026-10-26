import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Pill tabs whose state lives in the URL (filters are shareable).
 * Server-safe: each tab is a plain link.
 */
export function FilterTabs({
  label,
  items,
  className,
}: {
  label: string;
  items: { href: string; label: string; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-0.5 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.active
              ? "bg-accent text-primary ring-1 ring-primary/20 ring-inset dark:text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                item.active ? "bg-primary/15" : "bg-muted",
              )}
            >
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Builds `path?…` from the current params with some keys changed (empty values removed). */
export function withParams(
  path: string,
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
