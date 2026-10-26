import { Building2, CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";

import { BookmarkButton } from "@/components/shared/bookmark-button";
import { CategoryChip } from "@/components/shared/badges";
import { formatCampus } from "@/lib/campus-time";
import { isOpen, modeLabel, typeInfo } from "@/lib/careers";
import type { Opportunity } from "@/server/queries/careers";

/** An opportunity in the careers list (Phase G). Server-safe; the bookmark button is a client island. */
export function OpportunityCard({
  opportunity: o,
  saved,
}: {
  opportunity: Opportunity;
  saved: boolean;
}) {
  const type = typeInfo(o.type);
  const open = isOpen(o);
  return (
    <article className="flex gap-3 rounded-[22px] border bg-card p-5 shadow-soft">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip tint={type.tint}>{type.label}</CategoryChip>
          {!open && <CategoryChip tint="zinc">Closed</CategoryChip>}
          {!o.departmentId && <CategoryChip tint="indigo">Campus-wide</CategoryChip>}
        </div>
        <Link
          href={`/careers/${o.id}`}
          className="mt-2 block text-[17px] leading-snug font-extrabold hover:text-primary"
        >
          {o.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden /> {o.company}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden /> {modeLabel(o.mode)}
            {o.location ? ` · ${o.location}` : ""}
          </span>
          {o.deadline && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden />
              {open ? "Apply by" : "Closed"} {formatCampus(o.deadline, "dayTime")}
            </span>
          )}
        </div>
      </div>
      <BookmarkButton type="opportunity" id={o.id} initial={saved} className="shrink-0" />
    </article>
  );
}
