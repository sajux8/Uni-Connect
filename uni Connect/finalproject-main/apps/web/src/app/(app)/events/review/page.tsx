import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";

import { EventCard } from "@/components/events/event-card";
import { EventReviewActions } from "@/components/events/review-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listEventsToReview } from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events/review"].title };

/**
 * Events waiting for the viewer's approval (Phase C): club captains see their club's, coordinators
 * their department's and batches', super admins everything.
 */
export default async function Page() {
  const user = await requireApproved();
  const events = await listEventsToReview(user.id);

  return (
    <>
      <PageHeader
        title="Events to review"
        description="Approving publishes the event. If you decline, give a reason: the organizer sees it and can submit again."
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: "To review" }]}
      />
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing to review"
          description="Events submitted for your club, batch or department appear here."
        />
      ) : (
        <ul className="max-w-3xl space-y-4">
          {events.map((event) => (
            <li key={event.id} className="space-y-2.5">
              <EventCard event={event} registration={null} eligible showRegister={false} />
              <div className="flex justify-end">
                <EventReviewActions eventId={event.id} title={event.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
