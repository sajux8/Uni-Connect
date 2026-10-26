"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

// Pages visited in this tab since the app loaded. Used when the browser has no Navigation API.
let lastPath: string | null = null;
let moves = 0;

/** Counts in-app page changes so BackButton knows whether "back" stays inside the app. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) moves++;
    lastPath = pathname;
  }, [pathname]);
  return null;
}

function canGoBackInApp(): boolean {
  const nav = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof nav?.canGoBack === "boolean") return nav.canGoBack && moves > 0;
  return moves > 0;
}

/**
 * "← Back" on detail pages. Goes back in history when the previous page was in the app (so
 * you return to the feed, search results or filters you came from); otherwise, e.g. after a
 * refresh or from a shared link, it goes to `href`, the page's logical parent.
 */
export function BackButton({
  href,
  label = "Back",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (canGoBackInApp()) {
          event.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "-ml-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-bold text-muted-foreground transition-colors outline-none",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
