import {
  Ban,
  CalendarPlus,
  Clock,
  ExternalLink,
  FileText,
  Hash,
  History,
  MapPin,
  ShieldCheck,
  Timer,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { RelativeTime } from "@/components/community/relative-time";
import { RichTextContent } from "@/components/community/rich-text-content";
import { EventActions } from "@/components/events/event-actions";
import { AvailabilityChip, CapacityBar } from "@/components/events/event-card";
import { RegisterButton } from "@/components/events/register-button";
import { EventReviewActions } from "@/components/events/review-actions";
import { CategoryChip, OfficialBadge, RoleBadge } from "@/components/shared/badges";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { ReportButton } from "@/components/shared/report-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { audienceLabel } from "@/lib/announcements";
import { requireApproved } from "@/lib/auth/session";
import { formatCampus, formatCampusRange } from "@/lib/campus-time";
import { eventAvailability, eventCategoryInfo, formatLabel, isEligible } from "@/lib/events";
import { cn } from "@/lib/utils";
import { listDepartments } from "@/server/queries/departments";
import { isBookmarked } from "@/server/queries/bookmarks";
import { canReviewEventSpace, getEvent, getMyRegistration } from "@/server/queries/events";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getEvent(id);
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  await requireApproved();
  const event = await load((await params).id);
  return { title: event?.title ?? "Event" };
}

export default async function Page({ params }: PageProps<"/events/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const [event, departments, registration, saved] = await Promise.all([
    load(id),
    listDepartments(),
    getMyRegistration(id, user.id),
    isBookmarked(user.id, "event", id),
  ]);
  if (!event) notFound();

  const category = eventCategoryInfo(event.category);
  const availability = eventAvailability(event);
  const eligible = isEligible(event, {
    departmentId: user.departmentId,
    yearOfStudy: user.yearOfStudy,
  });
  const canManage = user.role === "super_admin" || event.organizerId === user.id;
  const canReview = event.status === "pending_review" && (await canReviewEventSpace(event.spaceId));
  const openToAll = event.departmentIds.length === 0 && event.years.length === 0;
  const deadline = event.registrationDeadline ?? event.startsAt;
  const online = event.format !== "in_person";
  const organizerRole = event.organizer?.role === "student" ? null : event.organizer?.role;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: event.title }]}
        title={event.title}
        actions={
          <>
            {event.status !== "draft" && (
              <BookmarkButton type="event" id={event.id} initial={saved} />
            )}
            {!canManage && event.organizerId !== user.id && event.status === "published" && (
              <ReportButton targetType="event" targetId={event.id} />
            )}
            {canManage && (
              <EventActions
                id={event.id}
                status={event.status}
                isDraft={!event.publishedAt}
                registeredCount={event.registeredCount}
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {event.official && <OfficialBadge />}
          <CategoryChip tint={category.tint}>{category.label}</CategoryChip>
          {event.place && <CategoryChip tint="indigo">{event.place.name}</CategoryChip>}
          <AvailabilityChip availability={availability} />
          <span className="text-sm font-semibold text-muted-foreground">
            {event.organizingUnit}
          </span>
        </div>
      </PageHeader>

      {event.status === "cancelled" && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm"
        >
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <strong className="text-destructive">This event has been cancelled.</strong>{" "}
            {event.cancelReason}
          </p>
        </div>
      )}
      {event.status === "pending_review" && (
        <div
          role="status"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm"
        >
          <Clock className="size-4 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1">
            {canReview
              ? "This event is waiting for your approval. Approving publishes it."
              : "Waiting for approval. Only you and the approvers can see it until then."}
          </p>
          {canReview && <EventReviewActions eventId={event.id} title={event.title} />}
        </div>
      )}
      {event.status === "rejected" && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm"
        >
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <strong className="text-destructive">Not approved.</strong>{" "}
            {event.reviewNote ? `“${event.reviewNote}” ` : ""}
            Edit the event and publish it again to send it back for approval.
          </p>
        </div>
      )}
      {event.status === "draft" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>This is a draft. Only you and super admins can see it. Publish it from the editor.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Meta panel first on phones: when, where and the register button matter most. */}
        <aside className="lg:sticky lg:top-24 lg:order-2 lg:self-start" aria-label="Event details">
          <div className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft">
            {event.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover from Supabase Storage
              <img
                src={event.coverUrl}
                alt=""
                className="-mx-5 -mt-5 mb-1 aspect-[16/7] w-[calc(100%+2.5rem)] max-w-none rounded-t-[22px] object-cover"
              />
            )}
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3">
                <dt className="sr-only">When</dt>
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <dd>
                  <p className="font-bold">{formatCampusRange(event.startsAt, event.endsAt)}</p>
                  <p className="text-[13px] text-muted-foreground">Sri Lanka time</p>
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="sr-only">Where</dt>
                {online ? (
                  <Video className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                )}
                <dd className="min-w-0">
                  <p className="font-bold">
                    {event.format === "online" ? "Online" : event.venue}
                    {event.format === "hybrid" && " + online"}
                  </p>
                  {event.locationDetails && (
                    <p className="text-[13px] text-muted-foreground">{event.locationDetails}</p>
                  )}
                  {event.onlineUrl &&
                    (registration?.status === "registered" || canManage ? (
                      <a
                        href={event.onlineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 text-[13px] font-bold text-primary hover:underline dark:text-accent-foreground"
                      >
                        Join link <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">
                        The join link appears here once you&apos;re registered.
                      </p>
                    ))}
                </dd>
              </div>
              {event.status === "published" && availability !== "past" && (
                <div className="flex gap-3">
                  <dt className="sr-only">Registration closes</dt>
                  <Timer className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <dd>
                    {availability === "closed" ? (
                      <p className="font-bold">Registration closed</p>
                    ) : (
                      <p>
                        Registration closes <RelativeTime date={deadline} className="font-bold" />
                        <span className="block text-[13px] text-muted-foreground">
                          {formatCampus(deadline, "dayTime")}
                        </span>
                      </p>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <CapacityBar
              registered={event.registeredCount}
              capacity={event.capacity}
              waitlist={event.waitlistCount}
            />
            <RegisterButton
              eventId={event.id}
              eventTitle={event.title}
              availability={availability}
              registration={registration}
              eligible={eligible}
              size="lg"
              className="w-full"
            />
            {!eligible && availability !== "cancelled" && availability !== "past" && (
              <p className="text-[13px] text-muted-foreground">
                Open to{" "}
                {audienceLabel(
                  { all: false, departmentIds: event.departmentIds, years: event.years },
                  departments,
                )}{" "}
                only.
              </p>
            )}
            {event.status !== "draft" && (
              <a
                href={`/api/events/${event.id}/ics`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                <CalendarPlus data-icon="inline-start" /> Add to calendar
              </a>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:order-1">
          <article className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
            <RichTextContent html={event.descriptionHtml} />
          </article>

          <section
            aria-labelledby="eligibility"
            className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
          >
            <h2
              id="eligibility"
              className="mb-2 flex items-center gap-2 text-[15px] font-extrabold"
            >
              <ShieldCheck className="size-4.5 text-primary" aria-hidden /> Who can come
            </h2>
            <p className="text-sm">
              {event.place
                ? `Open to members of ${event.place.name}.`
                : openToAll
                  ? "Open to everyone on campus."
                  : `Open to ${audienceLabel({ all: false, departmentIds: event.departmentIds, years: event.years }, departments)}.`}{" "}
              {formatLabel(event.format)}
              {event.capacity ? ` · ${event.capacity} seats` : " · No seat limit"}
              {event.capacity && event.waitlistEnabled ? " · Waitlist when full" : ""}.
            </p>
            {event.eligibilityNote && (
              <p className="mt-1 text-sm text-muted-foreground">{event.eligibilityNote}</p>
            )}
          </section>

          <section
            aria-labelledby="updates"
            className="rounded-[22px] border bg-card p-5 shadow-soft sm:p-7"
          >
            <h2 id="updates" className="mb-3 flex items-center gap-2 text-[15px] font-extrabold">
              <History className="size-4.5 text-primary" aria-hidden /> Updates
            </h2>
            {event.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No changes since it was published. If the time or place changes, everyone registered
                is told.
              </p>
            ) : (
              <ol className="space-y-3 border-l-2 border-border pl-4">
                {event.changes.map((c) => (
                  <li key={c.id} className="relative">
                    <span
                      className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary"
                      aria-hidden
                    />
                    <p className="text-sm font-semibold">{c.summary}</p>
                    <RelativeTime date={c.createdAt} className="text-xs text-muted-foreground" />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3 px-1 text-sm text-muted-foreground">
            {event.organizer && (
              <span className="inline-flex items-center gap-2">
                <UserAvatar name={event.organizer.name} src={event.organizer.avatarUrl} size="xs" />
                Organised by{" "}
                <Link
                  href={`/u/${event.organizer.username}`}
                  className="-my-2 inline-block py-2 font-semibold text-foreground hover:text-primary"
                >
                  {event.organizer.name}
                </Link>
                {organizerRole && <RoleBadge role={organizerRole} />}
              </span>
            )}
            {event.space && (
              <Link
                href={`/spaces/${event.space.slug}`}
                className="inline-flex min-h-9 items-center gap-1 font-semibold hover:text-primary"
              >
                <Hash className="size-3.5" aria-hidden /> {event.space.name}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
