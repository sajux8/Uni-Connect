import { ImageIcon, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CategoryChip } from "@/components/shared/badges";
import { RelativeTime } from "@/components/community/relative-time";
import { categoryLabel, KIND_LABELS, TICKET_STATUS } from "@/lib/support";
import type { TicketSummary } from "@/server/queries/support";

/** A ticket in a list (Phase F). Server-safe. `staff` shows who sent it (unless anonymous). */
export function TicketCard({ ticket, staff }: { ticket: TicketSummary; staff?: boolean }) {
  const status = TICKET_STATUS[ticket.status];
  return (
    <article className="flex flex-wrap items-start gap-3 rounded-[22px] border bg-card p-5 shadow-soft">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground">
          {KIND_LABELS[ticket.kind]} · {categoryLabel(ticket.kind, ticket.category)}
        </p>
        <Link
          href={`/support/${ticket.id}`}
          className="mt-0.5 block text-[16px] leading-snug font-extrabold hover:text-primary"
        >
          {ticket.subject}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {staff &&
            (ticket.isAnonymous ? (
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5" aria-hidden /> Anonymous
              </span>
            ) : (
              <span>
                {ticket.author?.name ?? "A member"}
                {ticket.batchName ? ` · ${ticket.batchName}` : ""}
              </span>
            ))}
          {!staff && ticket.isAnonymous && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5" aria-hidden /> Sent anonymously
            </span>
          )}
          {ticket.hasPhoto && (
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3.5" aria-hidden /> Photo
            </span>
          )}
          <span>
            Updated <RelativeTime date={ticket.updatedAt} />
          </span>
        </div>
      </div>
      <CategoryChip tint={status.tint}>{status.label}</CategoryChip>
    </article>
  );
}
