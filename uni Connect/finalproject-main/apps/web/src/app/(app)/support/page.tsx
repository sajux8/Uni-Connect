import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { TicketCard } from "@/components/support/ticket-card";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listMyTickets } from "@/server/queries/support";

export const metadata: Metadata = { title: ROUTES["/support"].title };

/** A member's support requests and complaints, with their status (Phase F). */
export default async function Page() {
  const user = await requireApproved();
  const tickets = await listMyTickets(user.id);
  return (
    <>
      <PageHeader
        title="Support"
        description="Ask for help or report a problem on campus. You're told when something changes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/support/new?kind=complaint"
              className={buttonVariants({ variant: "outline" })}
            >
              <MessageSquareWarning data-icon="inline-start" /> File a complaint
            </Link>
            <Link href="/support/new" className={buttonVariants()}>
              <LifeBuoy data-icon="inline-start" /> Contact support
            </Link>
          </div>
        }
      />
      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nothing sent yet"
          description="Support requests go to your department's coordinator. Complaints can be anonymous and can include a photo."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </>
  );
}
