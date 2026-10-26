import { Handshake, Inbox, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import {
  ActiveMentorshipButtons,
  RespondButtons,
  WithdrawButton,
} from "@/components/mentorship/request-actions";
import { CategoryChip, type CategoryTint } from "@/components/shared/badges";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import {
  canBeMentor,
  MENTORSHIP_STATUS_LABELS,
  MENTORSHIP_TABS,
  parseMentorshipTab,
  type MentorshipStatus,
  type MentorshipTab,
} from "@/lib/mentorship";
import { ROUTES } from "@/lib/routes";
import { getMyMentorProfile, listMyMentorships } from "@/server/queries/mentorship";
import type { MentorshipRequestItem } from "@/server/queries/mentorship";

export const metadata: Metadata = { title: ROUTES["/mentorship"].title };

const STATUS_TINTS: Record<MentorshipStatus, CategoryTint> = {
  pending: "amber",
  accepted: "emerald",
  declined: "red",
  cancelled: "zinc",
  ended: "zinc",
};

function inTab(item: MentorshipRequestItem, tab: MentorshipTab): boolean {
  switch (tab) {
    case "incoming":
      return item.iAmMentor && item.status === "pending";
    case "outgoing":
      return !item.iAmMentor && item.status === "pending";
    case "active":
      return item.status === "accepted";
    case "past":
      return ["declined", "cancelled", "ended"].includes(item.status);
  }
}

export default async function Page({ searchParams }: PageProps<"/mentorship">) {
  const user = await requireApproved();
  const params = await searchParams;
  const [items, mentorProfile] = await Promise.all([
    listMyMentorships(user.id),
    getMyMentorProfile(user.id),
  ]);
  const counts = Object.fromEntries(
    MENTORSHIP_TABS.map((t) => [t.key, items.filter((i) => inTab(i, t.key)).length]),
  ) as Record<MentorshipTab, number>;
  // Default to whatever needs attention first.
  const tab =
    parseMentorshipTab(params.tab) ??
    (counts.incoming > 0 ? "incoming" : counts.active > 0 ? "active" : "outgoing");
  const shown = items.filter((i) => inTab(i, tab));

  return (
    <>
      <PageHeader
        title="Mentorship"
        description="Requests you've sent and received, and the mentorships you're part of."
        actions={
          <Link href="/mentors" className={buttonVariants()}>
            <Handshake data-icon="inline-start" /> Find a mentor
          </Link>
        }
      >
        <FilterTabs
          label="Mentorship"
          items={MENTORSHIP_TABS.map((t) => ({
            href: `/mentorship?tab=${t.key}`,
            label: t.label,
            active: t.key === tab,
            count: t.key === "past" ? undefined : counts[t.key],
          }))}
        />
      </PageHeader>

      {shown.length === 0 ? (
        <EmptyTab
          tab={tab}
          isMentor={Boolean(mentorProfile)}
          canMentor={canBeMentor(user.yearOfStudy)}
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li key={item.id}>
              <RequestItem item={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RequestItem({ item }: { item: MentorshipRequestItem }) {
  const role = item.iAmMentor ? "Your mentee" : "Your mentor";
  return (
    <article className="space-y-4 rounded-[22px] border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <UserAvatar name={item.other.name} src={item.other.avatarUrl} size="md" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.other.username ? (
              <Link
                href={`/u/${item.other.username}`}
                className="font-extrabold hover:text-primary"
              >
                {item.other.name}
              </Link>
            ) : (
              <span className="font-extrabold">{item.other.name}</span>
            )}
            <CategoryChip tint={STATUS_TINTS[item.status]}>
              {MENTORSHIP_STATUS_LABELS[item.status]}
            </CategoryChip>
          </p>
          <p className="text-[13px] text-muted-foreground">
            {item.status === "accepted" ? role : item.iAmMentor ? "Asked you" : "You asked"} ·{" "}
            <RelativeTime date={item.createdAt} />
          </p>
        </div>
      </div>
      <div className="space-y-1.5 rounded-2xl bg-surface-tint p-3.5">
        <p className="font-bold">{item.topic}</p>
        <p className="text-sm whitespace-pre-line text-muted-foreground">{item.message}</p>
      </div>
      {item.responseNote && (
        <p className="text-sm">
          <span className="font-semibold">
            {item.iAmMentor ? "Your note:" : `${item.other.name.split(" ")[0]}'s note:`}
          </span>{" "}
          <span className="text-muted-foreground">{item.responseNote}</span>
        </p>
      )}
      {item.status === "pending" && item.iAmMentor && (
        <RespondButtons requestId={item.id} menteeName={item.other.name} />
      )}
      {item.status === "pending" && !item.iAmMentor && (
        <WithdrawButton requestId={item.id} mentorName={item.other.name} />
      )}
      {item.status === "accepted" && (
        <ActiveMentorshipButtons
          requestId={item.id}
          conversationId={item.conversationId}
          otherName={item.other.name}
        />
      )}
      {item.status === "ended" && item.conversationId && (
        <Link
          href={`/messages/${item.conversationId}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Read the conversation
        </Link>
      )}
    </article>
  );
}

function EmptyTab({
  tab,
  isMentor,
  canMentor,
}: {
  tab: MentorshipTab;
  isMentor: boolean;
  canMentor: boolean;
}) {
  if (tab === "incoming") {
    return (
      <EmptyState
        icon={Inbox}
        title="No requests waiting"
        description={
          isMentor
            ? "When a student asks you to mentor them, it shows up here."
            : canMentor
              ? "Set up a mentor profile so students can find you."
              : "Students in Year 2 and above can offer to mentor."
        }
        action={
          !isMentor && canMentor ? (
            <Link href="/settings/mentor" className={buttonVariants({ variant: "outline" })}>
              Become a mentor
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <EmptyState
      icon={tab === "outgoing" ? Send : Handshake}
      title={
        tab === "outgoing"
          ? "No requests waiting for an answer"
          : tab === "active"
            ? "No active mentorships"
            : "Nothing here yet"
      }
      description={
        tab === "past"
          ? "Declined, withdrawn and ended mentorships are kept here."
          : "Browse the directory and ask a senior student for guidance."
      }
      action={
        tab === "past" ? undefined : (
          <Link href="/mentors" className={buttonVariants({ variant: "outline" })}>
            Find a mentor
          </Link>
        )
      }
    />
  );
}
