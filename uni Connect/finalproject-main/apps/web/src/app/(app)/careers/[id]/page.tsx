import { Building2, CalendarClock, ExternalLink, Mail, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { OpportunityActions } from "@/components/careers/opportunity-actions";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import { isOpen, modeLabel, typeInfo } from "@/lib/careers";
import { canPostOpportunity, getOpportunity, savedOpportunityIds } from "@/server/queries/careers";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getOpportunity(id);
}

export async function generateMetadata({ params }: PageProps<"/careers/[id]">): Promise<Metadata> {
  await requireApproved();
  const o = await load((await params).id);
  return { title: o ? `${o.title} at ${o.company}` : "Opportunity" };
}

/** One opportunity (Phase G): the role, how to apply, and its deadline. */
export default async function Page({ params }: PageProps<"/careers/[id]">) {
  const user = await requireApproved();
  const o = await load((await params).id);
  if (!o) notFound();
  const [manage, saved] = await Promise.all([
    canPostOpportunity(o.departmentId),
    savedOpportunityIds(user.id),
  ]);
  const open = isOpen(o);
  const type = typeInfo(o.type);

  return (
    <>
      <PageHeader
        title={o.title}
        description={o.company}
        breadcrumbs={[{ label: "Careers", href: "/careers" }, { label: o.title }]}
        badge={
          open ? (
            <CategoryChip tint={type.tint}>{type.label}</CategoryChip>
          ) : (
            <CategoryChip tint="zinc">Closed</CategoryChip>
          )
        }
        actions={
          manage ? (
            <OpportunityActions id={o.id} title={o.title} status={o.status} />
          ) : (
            <BookmarkButton type="opportunity" id={o.id} initial={saved.has(o.id)} withLabel />
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="lg:order-2" aria-label="How to apply">
          <div className="space-y-4 rounded-[22px] border bg-card p-5 text-sm shadow-soft">
            <dl className="space-y-3">
              <div className="flex gap-3">
                <dt className="sr-only">Company</dt>
                <Building2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd className="font-bold">{o.company}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="sr-only">Where</dt>
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd className="font-bold">
                  {modeLabel(o.mode)}
                  {o.location ? ` · ${o.location}` : ""}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="sr-only">Deadline</dt>
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd className="font-bold">
                  {o.deadline
                    ? `${open ? "Apply by" : "Closed"} ${formatCampus(o.deadline, "dayTime")}`
                    : open
                      ? "No deadline"
                      : "Closed"}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="sr-only">For</dt>
                <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd>
                  {o.departmentName
                    ? `${o.departmentName}${o.batchIds.length ? " (some batches)" : ""}`
                    : "The whole campus"}
                </dd>
              </div>
            </dl>
            {open ? (
              <div className="space-y-2 border-t pt-4">
                {o.applyUrl && (
                  <a
                    href={o.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ className: "w-full" })}
                  >
                    Apply <ExternalLink data-icon="inline-end" />
                  </a>
                )}
                {o.applyEmail && (
                  <a
                    href={`mailto:${o.applyEmail}?subject=${encodeURIComponent(`Application: ${o.title}`)}`}
                    className={buttonVariants({
                      variant: o.applyUrl ? "outline" : "default",
                      className: "w-full",
                    })}
                  >
                    <Mail data-icon="inline-start" /> {o.applyEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="border-t pt-4 text-muted-foreground">Applications have closed.</p>
            )}
          </div>
        </aside>
        <article className="min-w-0 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7 lg:order-1">
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{o.description}</p>
          {o.postedBy && (
            <p className="mt-6 text-[13px] text-muted-foreground">
              Posted by {o.postedBy.name} · {formatCampus(o.createdAt, "day")}
            </p>
          )}
        </article>
      </div>
    </>
  );
}
