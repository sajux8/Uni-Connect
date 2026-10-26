import { formatCampus } from "@/lib/campus-time";
import { cn } from "@/lib/utils";
import type { WeekActivity } from "@/server/queries/admin";

const SERIES = [
  { key: "posts", label: "Posts", className: "bg-primary" },
  { key: "replies", label: "Replies", className: "bg-brand-cyan" },
  { key: "registrations", label: "Event sign-ups", className: "bg-success" },
  { key: "newMembers", label: "New members", className: "bg-warning" },
] as const;

/**
 * Weekly activity as grouped bars (plain HTML and CSS: no chart library). The numbers are
 * also in a visually hidden table for screen readers.
 */
export function ActivityChart({ weeks }: { weeks: WeekActivity[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => SERIES.map((s) => w[s.key])));
  return (
    <figure className="space-y-4">
      <div className="flex h-48 items-end gap-2 border-b pb-px sm:gap-4" aria-hidden>
        {weeks.map((w) => (
          <div key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              {SERIES.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${w[s.key]}`}
                  className={cn("w-full max-w-3 rounded-t-sm", s.className)}
                  style={{ height: `${Math.max(w[s.key] > 0 ? 3 : 0, (w[s.key] / max) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-4" aria-hidden>
        {weeks.map((w) => (
          <span
            key={w.weekStart}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
          >
            {formatCampus(`${w.weekStart}T12:00:00+05:30`, "dayNumber")}{" "}
            {formatCampus(`${w.weekStart}T12:00:00+05:30`, "monthShort")}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", s.className)} aria-hidden />
            {s.label}
          </span>
        ))}
        <span>· weeks start on Monday</span>
      </figcaption>
      <table className="sr-only">
        <caption>Activity per week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            {SERIES.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{w.weekStart}</th>
              {SERIES.map((s) => (
                <td key={s.key}>{w[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
