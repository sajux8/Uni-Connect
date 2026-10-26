import { MapPin, UserRound } from "lucide-react";
import Link from "next/link";

import { CategoryChip } from "@/components/shared/badges";
import { formatCampus } from "@/lib/campus-time";
import type { SessionState } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import type { ClassSession } from "@/server/queries/timetable";

/**
 * One class on a timetable (Phase D). Server-safe: pages compute `state` with the server's clock
 * and pass the Mark present button in as `action`. `present` is only set for students.
 */
export function SessionCard({
  session,
  state,
  present,
  showBatch,
  hideLecturer,
  action,
  className,
}: {
  session: ClassSession;
  state: SessionState;
  present?: boolean;
  showBatch?: boolean;
  /** In "Classes I teach" the lecturer is the viewer. */
  hideLecturer?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const cancelled = state === "cancelled";
  const pill =
    state === "cancelled" ? (
      <CategoryChip tint="red">Cancelled</CategoryChip>
    ) : state === "live" ? (
      present ? (
        <CategoryChip tint="emerald">Present</CategoryChip>
      ) : (
        <CategoryChip tint="blue">Now</CategoryChip>
      )
    ) : state === "ended" && present !== undefined ? (
      present ? (
        <CategoryChip tint="emerald">Present</CategoryChip>
      ) : (
        <CategoryChip tint="red">Absent</CategoryChip>
      )
    ) : null;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-3.5 shadow-soft",
        state === "live" && "border-primary/60 ring-2 ring-primary/15",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-bold text-muted-foreground tabular-nums">
          {formatCampus(session.startsAt, "time")}–{formatCampus(session.endsAt, "time")}
        </p>
        {pill}
      </div>
      <Link
        href={`/timetable/sessions/${session.id}`}
        className={cn(
          "mt-1 block leading-snug font-extrabold hover:text-primary",
          cancelled && "text-muted-foreground line-through",
        )}
      >
        {session.moduleName}
      </Link>
      {session.moduleCode && (
        <p className="text-xs font-semibold text-muted-foreground">{session.moduleCode}</p>
      )}
      <div className="mt-1.5 space-y-0.5 text-[13px] text-muted-foreground">
        {session.room && (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {session.room}
          </p>
        )}
        {session.lecturer && !hideLecturer && (
          <p className="flex items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0" aria-hidden /> {session.lecturer.name}
          </p>
        )}
        {showBatch && <p className="font-semibold">{session.batchName}</p>}
      </div>
      {cancelled && session.changeReason && (
        <p className="mt-2 text-[13px] text-destructive">{session.changeReason}</p>
      )}
      {!cancelled && session.movedFrom && (
        <p className="mt-2 text-[13px] text-warning">
          Moved from {formatCampus(session.movedFrom, "dayTime")}
          {session.changeReason ? `. ${session.changeReason}` : ""}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </article>
  );
}
