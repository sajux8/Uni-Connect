import { CalendarClock, UserRound } from "lucide-react";
import Link from "next/link";

import { CategoryChip } from "@/components/shared/badges";
import { formatCampus } from "@/lib/campus-time";
import { effectiveStatus } from "@/lib/forms";
import type { FormSummary } from "@/server/queries/forms";

const STATUS = {
  draft: { label: "Draft", tint: "zinc" },
  open: { label: "Open", tint: "emerald" },
  closed: { label: "Closed", tint: "zinc" },
} as const;

/** A feedback form in a list (Phase E). Server-safe. */
export function FormCard({
  form,
  href,
  showStatus,
  note,
}: {
  form: FormSummary;
  href: string;
  showStatus?: boolean;
  note?: React.ReactNode;
}) {
  const status = STATUS[effectiveStatus(form)];
  return (
    <article className="flex flex-wrap items-start gap-3 rounded-[22px] border bg-card p-5 shadow-soft">
      <div className="min-w-0 flex-1">
        <Link href={href} className="text-[17px] leading-snug font-extrabold hover:text-primary">
          {form.title}
        </Link>
        {form.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{form.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {form.aboutLecturer && (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden /> About {form.aboutLecturer.name}
            </span>
          )}
          {form.closesAt && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden />
              {effectiveStatus(form) === "closed" ? "Closed" : "Closes"}{" "}
              {formatCampus(form.closesAt, "dayTime")}
            </span>
          )}
          {note}
        </div>
      </div>
      {showStatus && <CategoryChip tint={status.tint}>{status.label}</CategoryChip>}
    </article>
  );
}
