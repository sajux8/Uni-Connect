import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { isEligible } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { listMyEvents, type MyEventsTab } from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events/mine"].title };

const EMPTY: Record<MyEventsTab, { title: string; description: string }> = {
  upcoming: { title: "No upcoming events", description: "Events you register for appear here." },
  waitlisted: {
    title: "You're not on any waitlists",
    description: "When an event is full you can join its waitlist.",
  },
  past: { title: "No past events yet", description: "Events you attended appear here afterwards." },
  cancelled: { title: "Nothing cancelled", description: "Registrations you cancel appear here." },
  organizing: {
    title: "You haven't created any events",
    description: "Events you create appear here, including ones waiting for approval.",
  },
};

export default async function Page({ searchParams }: PageProps<"/events/mine">) {
  const user = await requireApproved();
  const tabs: { key: MyEventsTab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "waitlisted", label: "Waitlisted" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
    { key: "organizing", label: "Organizing" },
  ];
  const params = await searchParams;
  const tab = tabs.find((t) => t.key === params.tab)?.key ?? "upcoming";
  const rows = await listMyEvents(user.id, tab);
  const viewer = { departmentId: user.departmentId, yearOfStudy: user.yearOfStudy };

  return (
    <>
      <PageHeader
        title="My events"
        description="Your registrations: upcoming, waitlisted and past."
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: "My events" }]}
      >
        <FilterTabs
          label="Show"
          items={tabs.map((t) => ({
            href: t.key === "upcoming" ? "/events/mine" : `/events/mine?tab=${t.key}`,
            label: t.label,
            active: tab === t.key,
          }))}
        />
      </PageHeader>
      <div className="max-w-3xl">
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={EMPTY[tab].title}
            description={EMPTY[tab].description}
            action={
              <Link
                href={tab === "organizing" ? "/events/new" : "/events"}
                className={buttonVariants({ variant: "outline" })}
              >
                {tab === "organizing" ? "Create an event" : "Browse events"}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {rows.map(({ event, registration }) => (
              <EventCard
                key={event.id}
                event={event}
                registration={registration?.status === "cancelled" ? null : registration}
                eligible={isEligible(event, viewer)}
                showRegister={tab !== "organizing"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
