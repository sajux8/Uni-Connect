import Link from "next/link";

import type { AiSourceRef } from "@/lib/ai/config";
import { formatCampus } from "@/lib/campus-time";
import { cn } from "@/lib/utils";

/** The numbered sources under an AI answer; citation chips scroll to and highlight one. */
export function SourceList({
  turnId,
  sources,
  title,
  highlight,
}: {
  turnId: number;
  sources: AiSourceRef[];
  title: string;
  highlight?: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold text-muted-foreground">{title}</h3>
      <ol className="grid gap-2 sm:grid-cols-2">
        {sources.map((s) => {
          const id = `source-${turnId}-${s.n}`;
          return (
            <li
              key={s.n}
              id={id}
              className={cn(
                "flex gap-2.5 rounded-2xl border bg-card px-3 py-2.5 transition-shadow",
                highlight === id && "border-ai ring-2 ring-ai/30",
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ai/15 text-xs font-bold text-ai">
                {s.n}
              </span>
              <span className="min-w-0">
                <Link
                  href={s.url}
                  className="line-clamp-2 text-sm leading-snug font-semibold hover:text-primary"
                >
                  {s.title}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {s.label}
                  {s.date ? ` · ${formatCampus(s.date, "day")}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
