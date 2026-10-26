import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { EventComposer } from "@/components/events/event-composer";
import { eventFormValues } from "@/components/events/event-form-values";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listDepartments } from "@/server/queries/departments";
import { getEvent, listEventPlacements } from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events/[id]/edit"].title };

export default async function Page({ params }: PageProps<"/events/[id]/edit">) {
  const user = await requireApproved();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [event, departments, placements] = await Promise.all([
    getEvent(id),
    listDepartments(),
    listEventPlacements(),
  ]);
  if (!event) notFound();

  const header = (
    <PageHeader
      title="Edit event"
      breadcrumbs={[
        { label: "Events", href: "/events" },
        { label: event.title, href: `/events/${event.id}` },
        { label: "Edit" },
      ]}
    />
  );

  if (event.organizerId !== user.id && user.role !== "super_admin") {
    return (
      <>
        {header}
        <NoAccessState
          title="You can't edit this event"
          description="Only the organizer who created it, or a super admin, can change it."
        />
      </>
    );
  }
  if (event.status === "cancelled") {
    return (
      <>
        {header}
        <NoAccessState
          title="This event was cancelled"
          description="Cancelled events can't be edited. Duplicate it to run it again."
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <EventComposer
          userId={user.id}
          eventId={event.id}
          published={Boolean(event.publishedAt)}
          initial={eventFormValues(event, true)}
          departments={departments}
          placements={
            placements.some((p) => p.id === (event.spaceId ?? ""))
              ? placements
              : [
                  {
                    id: event.spaceId ?? "",
                    name: event.place?.name ?? "Everyone on campus",
                    needsReview: false,
                  },
                  ...placements,
                ]
          }
        />
      </div>
    </>
  );
}
