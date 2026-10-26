import Link from "next/link";

import { RequestMentorButton } from "@/components/mentorship/request-mentor-dialog";
import { CategoryChip } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { yearLabel } from "@/lib/campus";
import { placesLeft } from "@/lib/mentorship";
import { cn } from "@/lib/utils";
import type { MentorCardData } from "@/server/queries/mentorship";

/** Green dot + "Accepting · 2 places free", or why they aren't. */
export function MentorAvailability({ mentor }: { mentor: MentorCardData }) {
  const free = placesLeft(mentor.maxActiveMentees, mentor.activeMenteeCount);
  const open = mentor.isAccepting && free > 0;
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", open ? "bg-success" : "bg-border-strong")}
      />
      {open
        ? `Accepting · ${free} ${free === 1 ? "place" : "places"} free`
        : mentor.isAccepting
          ? "Full at the moment"
          : "Not accepting right now"}
    </p>
  );
}

/** One mentor in the directory. */
export function MentorCard({ mentor, own }: { mentor: MentorCardData; own?: boolean }) {
  const year = yearLabel(mentor.yearOfStudy);
  const facts = [mentor.departmentName, year].filter(Boolean).join(" · ");
  return (
    <article
      aria-labelledby={`mentor-${mentor.userId}`}
      className="flex flex-col gap-4 rounded-[22px] border bg-card p-5 shadow-soft"
    >
      <div className="flex items-start gap-3.5">
        <UserAvatar name={mentor.name} src={mentor.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h3 id={`mentor-${mentor.userId}`} className="leading-snug font-extrabold">
            <Link
              href={`/u/${mentor.username}`}
              className="outline-none hover:text-primary focus-visible:underline"
            >
              {mentor.name}
            </Link>
            {own && <span className="ml-1.5 text-xs font-semibold text-muted-foreground">You</span>}
          </h3>
          {facts && <p className="truncate text-[13px] text-muted-foreground">{facts}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-pretty">{mentor.headline}</p>
        {mentor.about && (
          <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">{mentor.about}</p>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Subjects and skills">
        {mentor.subjects.map((s) => (
          <li key={`s-${s}`}>
            <CategoryChip tint="blue">{s}</CategoryChip>
          </li>
        ))}
        {mentor.skills.map((s) => (
          <li key={`k-${s}`}>
            <CategoryChip>{s}</CategoryChip>
          </li>
        ))}
      </ul>
      {mentor.availabilityNote && (
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">Availability:</span>{" "}
          {mentor.availabilityNote}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-4">
        <MentorAvailability mentor={mentor} />
        {own ? (
          <Link
            href="/settings/mentor"
            className="text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
          >
            Edit your profile
          </Link>
        ) : (
          <RequestMentorButton
            mentorId={mentor.userId}
            mentorName={mentor.name}
            myRequestStatus={mentor.myRequestStatus}
            blockReason={mentor.blockReason}
            showReason={
              mentor.isAccepting &&
              placesLeft(mentor.maxActiveMentees, mentor.activeMenteeCount) > 0
            }
          />
        )}
      </div>
    </article>
  );
}
