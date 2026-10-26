import type { Metadata } from "next";

import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { TicketForm } from "@/components/support/ticket-form";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { parseKind } from "@/lib/support";

export const metadata: Metadata = { title: ROUTES["/support/new"].title };

/** Contact support or file a complaint (Phase F). */
export default async function Page({ searchParams }: PageProps<"/support/new">) {
  const user = await requireApproved();
  const kind = parseKind((await searchParams).kind);
  return (
    <>
      <PageHeader
        title={kind === "complaint" ? "File a complaint" : "Contact support"}
        description={
          kind === "complaint"
            ? "Report a problem with facilities, teaching or safety. You can hide your name."
            : "Ask about your account, UniConnect or something academic."
        }
        breadcrumbs={[{ label: "Support", href: "/support" }, { label: "New" }]}
      >
        <FilterTabs
          label="Kind"
          items={[
            { href: "/support/new", label: "Support request", active: kind === "support" },
            {
              href: "/support/new?kind=complaint",
              label: "Complaint",
              active: kind === "complaint",
            },
          ]}
        />
      </PageHeader>
      <TicketForm key={kind} kind={kind} hasDepartment={!!user.departmentId} />
    </>
  );
}
