import "server-only";

import { addCampusDays, campusDayStart } from "@/lib/campus-time";
import type { parseLogFilters } from "@/lib/moderation";
import { listModerationLog, type LogEntry } from "@/server/queries/admin";

/** The log for the page and the CSV export, with the URL's filters applied. */
export function loadModerationLog(
  filters: ReturnType<typeof parseLogFilters>,
  limit: number,
): Promise<LogEntry[]> {
  return listModerationLog({
    action: filters.action,
    actorId: filters.actor,
    since: filters.from ? campusDayStart(filters.from) : undefined,
    until: filters.to ? campusDayStart(addCampusDays(filters.to, 1)) : undefined,
    limit,
  });
}
