import { formatDistanceToNowStrict } from "date-fns";

import { formatCampus } from "@/lib/campus-time";

/** "3h ago" with the exact campus time on hover. */
export function RelativeTime({ date, className }: { date: string; className?: string }) {
  const d = new Date(date);
  return (
    <time
      dateTime={d.toISOString()}
      title={`${formatCampus(d, "dayTime")} (Sri Lanka time)`}
      className={className}
      suppressHydrationWarning
    >
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}
