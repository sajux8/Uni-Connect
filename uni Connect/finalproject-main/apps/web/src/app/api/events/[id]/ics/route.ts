import * as z from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { buildIcs, formatLabel } from "@/lib/events";
import { appUrl } from "@/server/email/outbox";
import { getEvent } from "@/server/queries/events";

/** "Add to calendar": one event as an iCalendar file (Feature 6, criterion 9). */
export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/ics">) {
  const { id } = await params;
  const user = await getSessionProfile();
  if (!user || user.status !== "approved") {
    return new Response("Sign in to download this event.", { status: 401 });
  }
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const event = await getEvent(id);
  if (!event || event.status === "draft") return new Response("Not found", { status: 404 });

  const url = `${appUrl()}/events/${event.id}`;
  const location =
    event.format === "online"
      ? (event.onlineUrl ?? "Online")
      : [event.venue, event.locationDetails].filter(Boolean).join(", ");
  const description = [
    `${event.organizingUnit} · ${formatLabel(event.format)}`,
    event.onlineUrl ? `Join online: ${event.onlineUrl}` : "",
    event.descriptionText.slice(0, 1500),
    `Details: ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const ics = buildIcs({
    id: event.id,
    title: event.title,
    description,
    location,
    url,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    updatedAt: event.updatedAt,
    cancelled: event.status === "cancelled",
  });
  const filename =
    event.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event";
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
