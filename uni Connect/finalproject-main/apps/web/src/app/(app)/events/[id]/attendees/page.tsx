import { Download, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { CapacityBar } from "@/components/events/event-card";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { yearLabel } from "@/lib/campus";
import { formatCampus } from "@/lib/campus-time";
import type { RegistrationStatus } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getEvent, listAttendees } from "@/server/queries/events";

export const metadata: Metadata = { title: ROUTES["/events/[id]/attendees"].title };

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: "Registered",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
};

export default async function Page({ params, searchParams }: PageProps<"/events/[id]/attendees">) {
  await requireRole("lecturer");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [event, attendees] = await Promise.all([getEvent(id), listAttendees(id)]);
  if (!event) notFound();
  const query = await searchParams;
  const filter = (["registered", "waitlisted", "cancelled"] as const).find(
    (s) => s === query.status,
  );

  const header = (
    <PageHeader
      title="Attendees"
      description={event.title}
      breadcrumbs={[
        { label: "Events", href: "/events" },
        { label: event.title, href: `/events/${event.id}` },
        { label: "Attendees" },
      ]}
      actions={
        attendees && attendees.length > 0 ? (
          <a
            href={`/api/events/${event.id}/attendees.csv`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download data-icon="inline-start" /> Export CSV
          </a>
        ) : undefined
      }
    />
  );
  if (!attendees) {
    return (
      <>
        {header}
        <NoAccessState description="Only the event's organizer and super admins can see who registered." />
      </>
    );
  }

  const counts = {
    registered: attendees.filter((a) => a.status === "registered").length,
    waitlisted: attendees.filter((a) => a.status === "waitlisted").length,
    cancelled: attendees.filter((a) => a.status === "cancelled").length,
  };
  const shown = filter ? attendees.filter((a) => a.status === filter) : attendees;

  return (
    <>
      {header}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Status"
          items={[
            {
              href: `/events/${event.id}/attendees`,
              label: "All",
              active: !filter,
              count: attendees.length,
            },
            ...(["registered", "waitlisted", "cancelled"] as const).map((s) => ({
              href: withParams(`/events/${event.id}/attendees`, {}, { status: s }),
              label: STATUS_LABELS[s],
              active: filter === s,
              count: counts[s],
            })),
          ]}
        />
        <CapacityBar
          registered={counts.registered}
          capacity={event.capacity}
          waitlist={counts.waitlisted}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody here yet"
          description="People who register appear here as soon as they sign up."
        />
      ) : (
        <>
          {/* Table on wider screens */}
          <div className="hidden overflow-x-auto rounded-[22px] border bg-card shadow-soft md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-tint text-xs font-bold text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Year
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((a) => (
                  <tr key={a.userId}>
                    <td className="px-4 py-3 font-semibold">{a.fullName}</td>
                    <td className="px-4 py-3">{a.departmentName ?? "—"}</td>
                    <td className="px-4 py-3">{yearLabel(a.yearOfStudy) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} position={a.waitlistPosition} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatCampus(a.registeredAt, "dayTime")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Cards on phones */}
          <ul className="space-y-2 md:hidden">
            {shown.map((a) => (
              <li key={a.userId} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{a.fullName}</p>
                  <StatusPill status={a.status} position={a.waitlistPosition} />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {[a.departmentName, yearLabel(a.yearOfStudy)].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Registered {formatCampus(a.registeredAt, "dayTime")}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function StatusPill({ status, position }: { status: RegistrationStatus; position: number | null }) {
  return (
    <span
      className={cn(
        "tint inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap",
        status === "registered"
          ? "tint-emerald"
          : status === "waitlisted"
            ? "tint-amber"
            : "tint-zinc",
      )}
    >
      {status === "waitlisted" ? `Waitlist #${position}` : STATUS_LABELS[status]}
    </span>
  );
}
