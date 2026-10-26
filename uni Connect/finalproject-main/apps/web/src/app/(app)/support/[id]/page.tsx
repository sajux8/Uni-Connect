import { ArrowRightLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { TicketReply, TicketStatusControl } from "@/components/support/ticket-actions";
import { requireApproved } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import { categoryLabel, KIND_LABELS, TICKET_STATUS } from "@/lib/support";
import { cn } from "@/lib/utils";
import { canHandleTicket, getTicket, ownsTicket } from "@/server/queries/support";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getTicket(id);
}

export async function generateMetadata({ params }: PageProps<"/support/[id]">): Promise<Metadata> {
  await requireApproved();
  const ticket = await load((await params).id);
  return { title: ticket?.subject ?? "Ticket" };
}

/** One ticket: the request, its photo, replies and status changes (Phase F). */
export default async function Page({ params }: PageProps<"/support/[id]">) {
  await requireApproved();
  const ticket = await load((await params).id);
  if (!ticket) notFound();
  const [owner, handler] = await Promise.all([ownsTicket(ticket.id), canHandleTicket(ticket.id)]);
  const status = TICKET_STATUS[ticket.status];
  const canReply = !ticket.isAnonymous && (owner || handler);

  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={`${KIND_LABELS[ticket.kind]} · ${categoryLabel(ticket.kind, ticket.category)}`}
        badge={<CategoryChip tint={status.tint}>{status.label}</CategoryChip>}
        breadcrumbs={
          handler && !owner
            ? [
                { label: "Inbox", href: `/admin/inbox?kind=${ticket.kind}` },
                { label: ticket.subject },
              ]
            : [{ label: "Support", href: "/support" }, { label: ticket.subject }]
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="space-y-4 lg:order-2" aria-label="About this ticket">
          <div className="space-y-3 rounded-[22px] border bg-card p-5 text-sm shadow-soft">
            <dl className="space-y-3">
              <div>
                <dt className="text-[13px] font-bold text-muted-foreground">From</dt>
                <dd className="font-semibold">
                  {ticket.isAnonymous ? (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-primary" aria-hidden />
                      {owner ? "You (your name is hidden)" : "Anonymous"}
                    </span>
                  ) : owner ? (
                    "You"
                  ) : ticket.author ? (
                    <Link href={`/u/${ticket.author.username}`} className="hover:text-primary">
                      {ticket.author.name}
                    </Link>
                  ) : (
                    "A member"
                  )}
                  {!ticket.isAnonymous && ticket.batchName && (
                    <span className="block text-muted-foreground">{ticket.batchName}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-bold text-muted-foreground">Sent to</dt>
                <dd className="font-semibold">
                  {ticket.routeTo === "management"
                    ? "Campus management"
                    : `${ticket.departmentName ?? "Department"} coordinator`}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-bold text-muted-foreground">Sent</dt>
                <dd className="font-semibold">{formatCampus(ticket.createdAt, "dayTime")}</dd>
              </div>
            </dl>
          </div>
          {handler && (
            <div className="rounded-[22px] border bg-card p-5 shadow-soft">
              <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
            </div>
          )}
        </aside>

        <div className="min-w-0 space-y-4 lg:order-1">
          <article className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
            <p className="text-[15px] whitespace-pre-line">{ticket.body}</p>
            {ticket.hasPhoto && (
              <a href={`/api/tickets/${ticket.id}/photo`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- private photo through a short-lived signed URL */}
                <img
                  src={`/api/tickets/${ticket.id}/photo`}
                  alt="Photo attached to this ticket"
                  className="mt-4 max-h-96 rounded-2xl border object-contain"
                />
              </a>
            )}
          </article>

          <section aria-label="Updates" className="space-y-3">
            {ticket.messages.map((m) =>
              m.kind === "status" ? (
                <div
                  key={m.id}
                  className="flex gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm"
                >
                  <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p>
                      <span className="font-bold">{m.authorName ?? "Staff"}</span> marked it{" "}
                      <span className="font-bold">
                        {m.status ? TICKET_STATUS[m.status].label.toLowerCase() : "updated"}
                      </span>{" "}
                      ·{" "}
                      <span className="text-muted-foreground">
                        {formatCampus(m.createdAt, "dayTime")}
                      </span>
                    </p>
                    {m.body && <p className="mt-1 whitespace-pre-line">{m.body}</p>}
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-[22px] border p-4 text-sm shadow-soft",
                    m.fromStaff ? "bg-accent/40" : "bg-card",
                  )}
                >
                  <p className="mb-1 text-[13px]">
                    <span className="font-bold">
                      {m.fromStaff
                        ? (m.authorName ?? "Staff")
                        : owner
                          ? "You"
                          : (m.authorName ?? "Student")}
                    </span>
                    {m.fromStaff && <span className="text-muted-foreground"> · staff</span>} ·{" "}
                    <span className="text-muted-foreground">
                      {formatCampus(m.createdAt, "dayTime")}
                    </span>
                  </p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
              ),
            )}
          </section>

          {canReply ? (
            <div className="rounded-[22px] border bg-card p-5 shadow-soft">
              <TicketReply ticketId={ticket.id} staff={handler && !owner} />
            </div>
          ) : (
            ticket.isAnonymous && (
              <p className="text-sm text-muted-foreground">
                This complaint is anonymous, so there are no replies. Status updates and notes
                appear here{owner ? " and you're told about each one" : " and the sender is told"}.
              </p>
            )
          )}
        </div>
      </div>
    </>
  );
}
