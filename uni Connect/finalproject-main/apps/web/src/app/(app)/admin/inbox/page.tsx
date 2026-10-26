import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { FilterSelect } from "@/components/shared/filter-select";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { TicketCard } from "@/components/support/ticket-card";
import { requireRole } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import {
  categoriesFor,
  parseKind,
  parseStatus,
  TICKET_STATUS,
  type TicketStatus,
} from "@/lib/support";
import { listInbox } from "@/server/queries/support";
import { listTimetableBatches } from "@/server/queries/timetable";

export const metadata: Metadata = { title: ROUTES["/admin/inbox"].title };

/**
 * Support and complaints inbox (Phase F): coordinators see their department's tickets, super admins
 * everything. Filters by kind, status, category and batch live in the URL.
 */
export default async function Page({ searchParams }: PageProps<"/admin/inbox">) {
  const user = await requireRole("lecturer");
  if (!roleAtLeast(user.role, "coordinator")) {
    return (
      <>
        <PageHeader title="Inbox" description="Support requests and complaints." />
        <NoAccessState description="The inbox is for coordinators and campus management." />
      </>
    );
  }
  const params = await searchParams;
  const kind = parseKind(params.kind);
  // Default to what needs attention; "all" shows every status.
  const status: TicketStatus | undefined =
    params.status === "all" ? undefined : (parseStatus(params.status) ?? "open");
  const categories = categoriesFor(kind);
  const category = categories.find((c) => c.value === params.category)?.value;
  const batches = await listTimetableBatches(user);
  const batchId = batches.find((b) => b.id === params.batch)?.id;
  const current = {
    kind: kind === "support" ? undefined : kind,
    status: params.status as string | undefined,
    category,
    batch: batchId,
  };
  const tickets = await listInbox({ kind, status, category, batchId });

  return (
    <>
      <PageHeader
        title="Inbox"
        description={
          user.role === "super_admin"
            ? "Every support request and complaint on campus."
            : `Support requests and complaints from ${user.departmentName ?? "your department"}.`
        }
      >
        <div className="space-y-3">
          <FilterTabs
            label="Kind"
            items={[
              {
                href: withParams("/admin/inbox", {}, {}),
                label: "Support",
                active: kind === "support",
              },
              {
                href: withParams("/admin/inbox", {}, { kind: "complaint" }),
                label: "Complaints",
                active: kind === "complaint",
              },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="Status"
              options={[
                ...(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => ({
                  href: withParams("/admin/inbox", current, {
                    status: s === "open" ? undefined : s,
                  }),
                  label: TICKET_STATUS[s].label,
                  selected: status === s,
                })),
                {
                  href: withParams("/admin/inbox", current, { status: "all" }),
                  label: "All statuses",
                  selected: status === undefined,
                },
              ]}
            />
            <FilterSelect
              label="Category"
              options={[
                {
                  href: withParams("/admin/inbox", current, { category: undefined }),
                  label: "All categories",
                  selected: !category,
                },
                ...categories.map((c) => ({
                  href: withParams("/admin/inbox", current, { category: c.value }),
                  label: c.label,
                  selected: category === c.value,
                })),
              ]}
            />
            {batches.length > 0 && (
              <FilterSelect
                label="Batch"
                options={[
                  {
                    href: withParams("/admin/inbox", current, { batch: undefined }),
                    label: "All batches",
                    selected: !batchId,
                  },
                  ...batches.map((b) => ({
                    href: withParams("/admin/inbox", current, { batch: b.id }),
                    label: b.name,
                    selected: batchId === b.id,
                  })),
                ]}
              />
            )}
          </div>
        </div>
      </PageHeader>
      {tickets.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === "open" ? "Nothing waiting" : "No tickets here"}
          description={
            batchId
              ? "Anonymous complaints don't have a batch, so they never show under a batch filter."
              : "New support requests and complaints appear here, and you're told about each one."
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} staff />
          ))}
        </div>
      )}
    </>
  );
}
