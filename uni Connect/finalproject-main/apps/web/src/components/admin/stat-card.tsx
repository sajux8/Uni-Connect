import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * A number on the admin dashboard. Queue counts link to the
 * queue and are highlighted while something is waiting.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  href?: string;
  attention?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl",
          attention && value > 0 ? "tint tint-amber" : "bg-accent text-accent-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[28px] leading-none font-extrabold tracking-tight tabular-nums">
          {value.toLocaleString("en-GB")}
        </span>
        <span className="mt-1 block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </>
  );
  const className =
    "flex items-center gap-4 rounded-[22px] border bg-card p-5 shadow-soft transition-shadow";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "outline-none hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
