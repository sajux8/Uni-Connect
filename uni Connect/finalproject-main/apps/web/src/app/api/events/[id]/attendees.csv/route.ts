import * as z from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { yearLabel } from "@/lib/campus";
import { formatCampus } from "@/lib/campus-time";
import { csvField } from "@/lib/events";
import { getEvent, listAttendees } from "@/server/queries/events";

/** Byte-order mark so Excel opens UTF-8 names correctly. */
const BOM = String.fromCharCode(0xfeff);

/** Attendee list as CSV for the event's organizer or an admin (the RPC checks). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/events/[id]/attendees.csv">,
) {
  const { id } = await params;
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") return new Response("Unauthorized", { status: 401 });
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const [event, attendees] = await Promise.all([getEvent(id), listAttendees(id)]);
  if (!event) return new Response("Not found", { status: 404 });
  if (!attendees) return new Response("Only the organizer can export attendees.", { status: 403 });

  const header = [
    "Name",
    "Username",
    "Department",
    "Year",
    "Status",
    "Waitlist position",
    "Registered at",
  ];
  const rows = attendees.map((a) =>
    [
      a.fullName,
      a.username,
      a.departmentName,
      yearLabel(a.yearOfStudy),
      a.status,
      a.waitlistPosition,
      formatCampus(a.registeredAt, "dayTime"),
    ]
      .map(csvField)
      .join(","),
  );
  const csv = BOM + [header.join(","), ...rows].join("\r\n") + "\r\n";
  const filename = `attendees-${
    event.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "event"
  }.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
