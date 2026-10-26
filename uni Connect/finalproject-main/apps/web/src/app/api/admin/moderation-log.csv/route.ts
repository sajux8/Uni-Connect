import { getSessionProfile } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import { csvField } from "@/lib/events";
import { MODERATION_ACTION_LABELS, parseLogFilters } from "@/lib/moderation";
import { loadModerationLog } from "@/server/queries/moderation-log";
import { roleAtLeast } from "@/lib/campus";

/** Byte-order mark so Excel opens UTF-8 names correctly. */
const BOM = String.fromCharCode(0xfeff);

/** The moderation log as CSV, with the same filters as the page (coordinators and super admins). */
export async function GET(request: Request) {
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return new Response("Unauthorized", { status: 401 });
  if (!roleAtLeast(user.role, "coordinator")) {
    return new Response("Only coordinators and super admins can export the log.", { status: 403 });
  }
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const entries = await loadModerationLog(parseLogFilters(params), 5000);

  const header = [
    "When (Sri Lanka time)",
    "Moderator",
    "Action",
    "Target type",
    "Target id",
    "Reason",
    "Report id",
  ];
  const rows = entries.map((e) =>
    [
      formatCampus(e.createdAt, "dayTime"),
      e.actor.name ?? (e.actor.id ? "Former member" : "System"),
      MODERATION_ACTION_LABELS[e.action],
      e.targetType,
      e.targetId,
      e.reason,
      e.reportId,
    ]
      .map(csvField)
      .join(","),
  );
  const csv = BOM + [header.join(","), ...rows].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="moderation-log.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
