import { format } from "date-fns";
import {
  CircleHelp,
  Library,
  Lock,
  MessagesSquare,
  PenSquare,
  ScrollText,
  Settings,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JoinButton } from "@/components/community/join-button";
import { PostFeed } from "@/components/community/post-feed";
import { JoinRequestItem, NotifySelect } from "@/components/community/space-controls";
import { SpaceIcon } from "@/components/community/space-icon";
import { CategoryChip, RoleBadge } from "@/components/shared/badges";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { ReportButton } from "@/components/shared/report-dialog";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ResourceCard } from "@/components/resources/resource-card";
import { BackButton } from "@/components/shared/back-button";
import { spaceTypeInfo } from "@/lib/community";
import { cn } from "@/lib/utils";
import { parseQuestionFilter, parseSort } from "@/lib/validation/posts";
import { listPosts } from "@/server/queries/posts";
import { listResources } from "@/server/queries/resources";
import { getBatchForSpace } from "@/server/queries/batches";
import { getSpace, listMembers } from "@/server/queries/spaces";

const TABS = [
  { key: "discussions", label: "Discussions" },
  { key: "questions", label: "Questions" },
  { key: "resources", label: "Resources" },
  { key: "about", label: "About & rules" },
  { key: "members", label: "Members" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: PageProps<"/spaces/[slug]">): Promise<Metadata> {
  const user = await requireApproved();
  const space = await getSpace((await params).slug, user.id);
  return { title: space?.name ?? "Space" };
}

export default async function Page({ params, searchParams }: PageProps<"/spaces/[slug]">) {
  const user = await requireApproved();
  const { slug } = await params;
  const query = await searchParams;
  const space = await getSpace(slug, user.id);
  if (!space) notFound();

  const tab: Tab = TABS.some((t) => t.key === query.tab) ? (query.tab as Tab) : "discussions";
  const sort = parseSort(query.sort);
  const filter = parseQuestionFilter(query.filter);
  const current = {
    tab: tab === "discussions" ? undefined : tab,
    sort: sort === "latest" ? undefined : sort,
    filter: filter === "all" ? undefined : filter,
  };
  const path = `/spaces/${space.slug}`;
  const type = spaceTypeInfo(space.type);
  // Department and batch spaces follow the profile: nobody joins or leaves them by hand.
  const automatic = space.type === "department" || space.type === "batch";
  const batch = space.type === "batch" ? await getBatchForSpace(space.id) : null;
  const membership =
    space.membership?.status === "active"
      ? "active"
      : space.membership?.status === "pending"
        ? "pending"
        : "none";

  return (
    <>
      {/* The space header plays the PageHeader role here: one H1, breadcrumb, actions. */}
      <section className="mb-6 overflow-hidden rounded-[22px] border bg-card shadow-soft">
        <div
          className="h-20 bg-[linear-gradient(120deg,var(--brand-navy),var(--brand-bright)_70%,var(--brand-cyan))]"
          aria-hidden
        />
        <div className="space-y-4 px-5 pb-6 sm:px-7">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-3">
            <SpaceIcon
              icon={space.icon}
              type={space.type}
              size="lg"
              className="bg-card ring-4 ring-card"
            />
            <div className="flex flex-wrap items-center gap-2">
              {space.membership?.status === "active" && (
                <NotifySelect spaceId={space.id} initial={space.membership.notifyLevel} />
              )}
              {!automatic && (
                <JoinButton
                  spaceId={space.id}
                  spaceName={space.name}
                  joinPolicy={space.joinPolicy}
                  initial={membership}
                  size="default"
                />
              )}
              {space.canPost && (
                <Link href={`/posts/new?space=${space.slug}`} className={buttonVariants()}>
                  <PenSquare data-icon="inline-start" /> New post
                </Link>
              )}
              {space.isModerator ? (
                <Link
                  href={`/spaces/${space.slug}/settings`}
                  className={buttonVariants({ variant: "outline", size: "icon" })}
                  aria-label="Space settings"
                >
                  <Settings />
                </Link>
              ) : (
                <ReportButton targetType="space" targetId={space.id} label="Report space" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BackButton href={space.parent ? `/spaces/${space.parent.slug}` : "/spaces"} />
              <nav
                aria-label="Breadcrumb"
                className="hidden text-[13px] font-semibold text-muted-foreground sm:block"
              >
                <Link href="/spaces" className="-my-2 py-2 hover:text-primary">
                  Spaces
                </Link>
                {space.parent && (
                  <>
                    <span aria-hidden className="mx-1.5">
                      /
                    </span>
                    <Link
                      href={`/spaces/${space.parent.slug}`}
                      className="-my-2 py-2 hover:text-primary"
                    >
                      {space.parent.name}
                    </Link>
                  </>
                )}
              </nav>
            </div>
            <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[30px]">
              {space.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <CategoryChip tint={type.tint}>{type.label}</CategoryChip>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden /> {space.memberCount}{" "}
                {space.memberCount === 1 ? "member" : "members"}
              </span>
              {space.joinPolicy === "approval" && !automatic && (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-4" aria-hidden /> Moderators approve new members
                </span>
              )}
              {automatic && (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-4" aria-hidden />
                  {space.type === "batch"
                    ? "Only this batch, its lecturers and the coordinator"
                    : "Only this department"}
                </span>
              )}
            </div>
            {space.description && (
              <p className="max-w-prose text-[15.5px] text-muted-foreground">{space.description}</p>
            )}
            {batch && (batch.rep || batch.lecturers.length > 0) && (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm">
                {batch.rep && (
                  <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground">Class rep</dt>
                    <dd className="flex items-center gap-1.5">
                      <UserAvatar name={batch.rep.name} src={batch.rep.avatarUrl} size="xs" />
                      <Link
                        href={`/u/${batch.rep.username}`}
                        className="font-bold text-rep-foreground hover:underline"
                      >
                        {batch.rep.name}
                      </Link>
                      <RoleBadge role="rep" />
                    </dd>
                  </div>
                )}
                {batch.lecturers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground">
                      {batch.lecturers.length === 1 ? "Lecturer" : "Lecturers"}
                    </dt>
                    <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {batch.lecturers.map((l) => (
                        <Link
                          key={l.id}
                          href={`/u/${l.username}`}
                          className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"
                        >
                          <UserAvatar name={l.name} src={l.avatarUrl} size="xs" />
                          {l.name}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      </section>

      {space.batches.length > 0 && (
        <section aria-labelledby="batches-title" className="mb-6">
          <h2
            id="batches-title"
            className="mb-2.5 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase"
          >
            Batches
          </h2>
          <ul className="-mx-1 flex [scrollbar-width:none] gap-2.5 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
            {space.batches.map((b) => (
              <li key={b.id} className="shrink-0">
                <Link
                  href={`/spaces/${b.slug}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 shadow-soft transition-colors hover:border-border-strong",
                    b.mine && "border-primary/40 bg-accent",
                  )}
                >
                  <SpaceIcon icon="GraduationCap" type="batch" size="sm" />
                  <span>
                    <span className="block text-sm font-bold">
                      {b.name.replace(`${space.name} `, "")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {b.mine ? "Your batch" : `${b.memberCount} members`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FilterTabs
        label="Space sections"
        className="mb-5"
        items={TABS.map((t) => ({
          href: withParams(path, {}, { tab: t.key === "discussions" ? undefined : t.key }),
          label: t.label,
          active: tab === t.key,
        }))}
      />

      {tab === "about" ? (
        <AboutTab space={space} />
      ) : !space.canViewContent ? (
        automatic ? (
          <NoAccessState
            title={
              space.type === "batch"
                ? "This batch's space is private"
                : "This department's space is private"
            }
            description={
              space.type === "batch"
                ? "Only the batch, its lecturers and the coordinator can see its posts."
                : "Only members of this department can see its posts."
            }
          />
        ) : (
          <NoAccessState
            title="This space is for members"
            description="Its moderators approve new members. Request to join to see its discussions."
          />
        )
      ) : tab === "members" ? (
        <MembersTab spaceId={space.id} isModerator={space.isModerator} />
      ) : tab === "resources" ? (
        <ResourcesTab spaceId={space.id} spaceSlug={space.slug} />
      ) : (
        <PostsTab
          sharedFromSpaceIds={space.batches.map((b) => b.id)}
          spaceId={space.id}
          spaceSlug={space.slug}
          type={tab === "questions" ? "question" : "discussion"}
          sort={sort}
          filter={filter}
          path={path}
          current={current}
          viewerId={user.id}
        />
      )}
    </>
  );
}

async function PostsTab({
  sharedFromSpaceIds,
  spaceId,
  spaceSlug,
  type,
  sort,
  filter,
  path,
  current,
  viewerId,
}: {
  /** A department's batch spaces: their department-wide posts also appear here. */
  sharedFromSpaceIds: string[];
  spaceId: string;
  spaceSlug: string;
  type: "discussion" | "question";
  sort: "latest" | "new" | "top";
  filter: "all" | "unanswered" | "solved" | "mine";
  path: string;
  current: Record<string, string | undefined>;
  viewerId: string;
}) {
  const question = type === "question";
  const { items, hasMore } = await listPosts({
    spaceIds: [spaceId],
    sharedFromSpaceIds,
    type,
    sort,
    filter: question ? filter : undefined,
    viewerId,
    pinnedFirst: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {question ? (
          <FilterTabs
            label="Question filter"
            items={(["all", "unanswered", "solved", "mine"] as const).map((f) => ({
              href: withParams(path, current, { filter: f === "all" ? undefined : f }),
              label: { all: "All", unanswered: "Unanswered", solved: "Solved", mine: "Mine" }[f],
              active: filter === f,
            }))}
          />
        ) : (
          <span />
        )}
        <FilterTabs
          label="Sort"
          items={(["latest", "new", "top"] as const).map((s) => ({
            href: withParams(path, current, { sort: s === "latest" ? undefined : s }),
            label: { latest: "Active", new: "Newest", top: "Top" }[s],
            active: sort === s,
          }))}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={question ? CircleHelp : MessagesSquare}
          title={
            question
              ? filter === "unanswered"
                ? "No unanswered questions 🎉"
                : "No questions yet"
              : "No discussions yet"
          }
          description={
            question
              ? "Ask the first question in this space."
              : "Start the first conversation in this space."
          }
          action={
            <Link href={`/posts/new?space=${spaceSlug}&type=${type}`} className={buttonVariants()}>
              <PenSquare data-icon="inline-start" />{" "}
              {question ? "Ask a question" : "Start a discussion"}
            </Link>
          }
        />
      ) : (
        <PostFeed
          key={`${type}-${sort}-${filter}`}
          initial={items}
          initialHasMore={hasMore}
          showSpace={false}
          query={{ scope: "space", spaceId, type, sort, filter: question ? filter : undefined }}
        />
      )}
    </div>
  );
}

function AboutTab({ space }: { space: Awaited<ReturnType<typeof getSpace>> & object }) {
  const rules = (space.rules ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-[22px] border bg-card p-6 shadow-soft">
        <h2 className="mb-3 flex items-center gap-2 text-[17px] font-extrabold">
          <ScrollText className="size-5 text-primary" aria-hidden /> Community rules
        </h2>
        {rules.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-5 text-[15px]">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            This space follows the general UniConnect community rules.
          </p>
        )}
      </section>
      <section className="space-y-3 rounded-[22px] border bg-card p-6 text-sm shadow-soft">
        <h2 className="text-[17px] font-extrabold">About</h2>
        <p className="text-muted-foreground">{space.description}</p>
        <dl className="space-y-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-semibold">{space.memberCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Joining</dt>
            <dd className="font-semibold">
              {space.joinPolicy === "open" ? "Open to everyone" : "Moderator approval"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-semibold">{format(new Date(space.createdAt), "d MMM yyyy")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

async function MembersTab({ spaceId, isModerator }: { spaceId: string; isModerator: boolean }) {
  const [members, requests] = await Promise.all([
    listMembers(spaceId, "active"),
    isModerator ? listMembers(spaceId, "pending") : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      {isModerator && requests.length > 0 && (
        <section className="rounded-[22px] border bg-card shadow-soft">
          <h2 className="flex items-center gap-2 border-b px-5 py-4 text-[16px] font-extrabold">
            <UserPlus className="size-5 text-primary" aria-hidden /> Join requests (
            {requests.length})
          </h2>
          <ul className="divide-y">
            {requests.map((r) => (
              <JoinRequestItem key={r.userId} spaceId={spaceId} user={r} />
            ))}
          </ul>
        </section>
      )}
      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Be the first to join this space."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m.userId}>
              <Link
                href={`/u/${m.username}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <UserAvatar name={m.fullName} src={m.avatarUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{m.fullName}</span>
                    {m.role === "moderator" && <RoleBadge role="moderator" />}
                    {m.role === "captain" && <RoleBadge role="captain" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{m.username}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function ResourcesTab({ spaceId, spaceSlug }: { spaceId: string; spaceSlug: string }) {
  const resources = await listResources({ spaceId, limit: 60 });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/resources/new?space=${spaceSlug}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Upload data-icon="inline-start" /> Share a resource here
        </Link>
      </div>
      {resources.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No resources yet"
          description="Notes, slides and useful links shared in this space appear here once a moderator approves them."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
