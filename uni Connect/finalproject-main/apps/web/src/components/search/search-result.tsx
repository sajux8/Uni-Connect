import {
  CalendarDays,
  CircleHelp,
  Library,
  Megaphone,
  MessagesSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { formatCampus } from "@/lib/campus-time";
import { KIND_LABELS, splitHighlights, type SearchKind } from "@/lib/search";
import type { SearchHit } from "@/server/queries/search";

export const KIND_ICONS: Record<SearchKind, LucideIcon> = {
  discussion: MessagesSquare,
  question: CircleHelp,
  event: CalendarDays,
  announcement: Megaphone,
  resource: Library,
  person: UserRound,
};

/** Text with the search matches wrapped in <mark>. Plain text only, so it's safe. */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitHighlights(text).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-primary/15 px-0.5 font-semibold text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function SearchResult({ hit }: { hit: SearchHit }) {
  const Icon = KIND_ICONS[hit.kind];
  return (
    <li>
      <Link
        href={hit.url}
        className="flex gap-3 rounded-2xl px-3 py-3 transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block leading-snug font-bold">{hit.title}</span>
          {hit.snippet && (
            <span className="line-clamp-2 block text-sm text-muted-foreground">
              <Highlighted text={hit.snippet} />
            </span>
          )}
          <span className="block text-xs text-muted-foreground">
            {KIND_LABELS[hit.kind]}
            {hit.context ? ` · ${hit.context}` : ""}
            {hit.createdAt && hit.kind !== "person"
              ? ` · ${formatCampus(hit.createdAt, "day")}`
              : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}
