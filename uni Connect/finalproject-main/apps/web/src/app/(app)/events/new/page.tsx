import type { Metadata } from "next";
import * as z from "zod";

import { EventComposer, type EventFormValues } from "@/components/events/event-composer";
import { eventFormValues } from "@/components/events/event-form-values";
import { PageHeader } from "@/components/shared/page-header";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listDepartments } from "@/server/queries/departments";
import { getEvent, listEventPlacements } from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events/new"].title };

export default async function Page({ searchParams }: PageProps<"/events/new">) {
  const user = await requireApproved();
  const { from } = await searchParams;
  const [departments, placements, source] = await Promise.all([
    listDepartments(),
    listEventPlacements(),
    typeof from === "string" && z.uuid().safeParse(from).success ? getEvent(from) : null,
  ]);

  const initial: EventFormValues = source
    ? { ...eventFormValues(source, false), title: `${source.title} (copy)`.slice(0, 150) }
    : {
        title: "",
        descriptionHtml: "",
        category: "workshop",
        organizingUnit: user.departmentName ?? "",
        format: "in_person",
        venue: "",
        locationDetails: "",
        onlineUrl: "",
        startsAt: "",
        endsAt: "",
        registrationDeadline: "",
        capacity: "",
        waitlistEnabled: true,
        departmentIds: [],
        years: [],
        eligibilityNote: "",
        coverUrl: "",
        // Your batch (or department, or club) first.
        spaceId: placements[0]?.id ?? "",
      };

  return (
    <>
      <PageHeader
        title={source ? "Duplicate event" : "New event"}
        description={
          source
            ? "Everything is copied except the dates. Choose new ones and publish."
            : "Create an event and open registration. Club events are approved by the captain; batch and department events by the coordinator."
        }
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: "New" }]}
      />
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <EventComposer
          userId={user.id}
          initial={initial}
          departments={departments}
          placements={placements}
        />
      </div>
    </>
  );
}
