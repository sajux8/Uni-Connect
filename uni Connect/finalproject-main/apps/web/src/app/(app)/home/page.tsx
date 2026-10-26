import { CircleHelp, Hash, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { JoinButton } from "@/components/community/join-button";
import { PostFeed } from "@/components/community/post-feed";
import { SpaceIcon } from "@/components/community/space-icon";
import { DayBoard, EarlierClasses } from "@/components/home/day-board";
import { NowLine } from "@/components/home/now-line";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { formatCampus } from "@/lib/campus-time";
import { buildBoard, nextBoardChange } from "@/lib/home-board";
import { ROUTES } from "@/lib/routes";
import { listPinnedAnnouncements } from "@/server/queries/announcements";
import { upcomingForUser } from "@/server/queries/events";
import { formsToAnswer } from "@/server/queries/forms";
import { feedSpaceIds } from "@/server/queries/feed";
import { listPosts } from "@/server/queries/posts";
import { listSpaces } from "@/server/queries/spaces";
import { homeClasses } from "@/server/queries/timetable";

export const metadata: Metadata = { title: ROUTES["/home"].title };

const TABS = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "latest", label: "Latest" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Colombo",
    }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function Page({ searchParams }: PageProps<"/home">) {
  const user = await requireApproved();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "foryou";
  const now = new Date();

  const [spaceIds, spaces] = await Promise.all([
    tab === "latest" ? Promise.resolve(undefined) : feedSpaceIds(user.id, tab),
    listSpaces(user.id),
  ]);
  const [feed, unanswered, pinned, upcoming, classes, feedback] = await Promise.all([
    listPosts({ spaceIds, sort: "latest" }),
    user.departmentId
      ? listPosts({
          spaceIds: spaces.filter((s) => s.departmentId === user.departmentId).map((s) => s.id),
          filter: "unanswered",
          sort: "new",
          limit: 5,
        })
      : Promise.resolve({ items: [], hasMore: false }),
    listPinnedAnnouncements(true),
    upcomingForUser(user.id, 3),
    homeClasses(user, now),
    formsToAnswer(user),
  ]);
  const suggested = spaces
    // Department and batch spaces aren't joined by hand.
    .filter((s) => !s.membership && s.type !== "department" && s.type !== "batch")
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 4);
  const firstName = user.fullName.split(/\s+/)[0];
  const student = user.role === "student";
  const board = buildBoard({
    sessions: classes.sessions,
    present: classes.present,
    events: upcoming,
    forms: feedback.slice(0, 3),
    now,
  });

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        description={formatCampus(now, "dayLong")}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <DayBoard
            groups={board.groups}
            student={student}
            eventsLink={
              upcoming.length > 0
                ? { href: "/events/mine", label: "All my events" }
                : { href: "/events", label: "Browse events" }
            }
            formsLink={
              feedback.length > 0
                ? {
                    href: "/forms",
                    label:
                      feedback.length > 3 ? `All ${feedback.length} forms` : "All feedback forms",
                  }
                : undefined
            }
          />

          <NowLine
            now={now}
            pinned={pinned}
            refreshAt={nextBoardChange([...classes.sessions, ...upcoming], now)}
          />

          <section aria-labelledby="earlier" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="earlier" className="text-[17px] font-extrabold">
                Earlier
              </h2>
              <FilterTabs
                label="Feed"
                items={TABS.map((t) => ({
                  href: withParams("/home", {}, { tab: t.key === "foryou" ? undefined : t.key }),
                  label: t.label,
                  active: tab === t.key,
                }))}
              />
            </div>
            <EarlierClasses rows={board.earlier} student={student} />
            {feed.items.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title={
                  tab === "following" ? "Join some spaces to fill your feed" : "Nothing posted yet"
                }
                description={
                  tab === "following"
                    ? "Posts from the spaces you join appear here."
                    : "Be the first: ask a question or start a discussion."
                }
                action={
                  <Link
                    href={tab === "following" ? "/spaces" : "/posts/new"}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    {tab === "following" ? "Browse spaces" : "Create a post"}
                  </Link>
                }
              />
            ) : (
              <PostFeed
                key={tab}
                initial={feed.items}
                initialHasMore={feed.hasMore}
                query={{ scope: tab, sort: "latest" }}
              />
            )}
          </section>
        </div>

        <aside className="space-y-5" aria-label="Highlights">
          {user.departmentName && (
            <RailCard title={`Unanswered in ${user.departmentName}`} icon={CircleHelp}>
              {unanswered.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one is waiting for an answer right now.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {unanswered.items.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/posts/${q.id}`}
                        className="line-clamp-2 py-1 text-sm font-semibold hover:text-primary"
                      >
                        {q.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/questions?filter=unanswered"
                className="inline-flex min-h-10 items-center text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
              >
                Help answer questions
              </Link>
            </RailCard>
          )}

          {suggested.length > 0 && (
            <RailCard title="Suggested spaces" icon={Hash}>
              <ul className="space-y-3">
                {suggested.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <SpaceIcon
                      icon={s.icon}
                      type={s.type}
                      size="sm"
                      className="size-9 rounded-xl [&_svg]:size-4"
                    />
                    <Link
                      href={`/spaces/${s.slug}`}
                      className="min-w-0 flex-1 truncate py-2.5 text-sm font-semibold hover:text-primary"
                    >
                      {s.name}
                    </Link>
                    <JoinButton
                      spaceId={s.id}
                      spaceName={s.name}
                      joinPolicy={s.joinPolicy}
                      initial="none"
                    />
                  </li>
                ))}
              </ul>
            </RailCard>
          )}
        </aside>
      </div>
    </>
  );
}

function RailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Hash;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
        <Icon className="size-4.5 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}
