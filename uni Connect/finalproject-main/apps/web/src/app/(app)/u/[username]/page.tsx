import { format } from "date-fns";
import { Building2, CalendarDays, GraduationCap, MessagesSquare, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostFeed } from "@/components/community/post-feed";
import { MentorAvailability } from "@/components/mentorship/mentor-card";
import { RequestMentorButton } from "@/components/mentorship/request-mentor-dialog";
import { ProfileMenu } from "@/components/profile/block-user-dialog";
import { CategoryChip, RoleBadge } from "@/components/shared/badges";
import { BackButton } from "@/components/shared/back-button";
import { Eyebrow, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { yearLabel } from "@/lib/campus";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getMentorCard } from "@/server/queries/mentorship";
import { canListPostsOf, listPosts } from "@/server/queries/posts";

async function loadProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_cards")
    .select(
      "id, full_name, username, avatar_url, role, department_name, year_of_study, bio, interests, expertise, profile_visibility, created_at",
    )
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  return { title: profile?.full_name ?? "Profile" };
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const viewer = await requireApproved();
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile?.id || !profile.full_name) notFound();

  const own = profile.id === viewer.id;
  const supabase = await createClient();
  const [mentor, { data: block }, showPosts] = await Promise.all([
    getMentorCard(profile.id, viewer.id),
    own
      ? Promise.resolve({ data: null })
      : supabase
          .from("user_blocks")
          .select("blocked_id")
          .eq("blocked_id", profile.id)
          .maybeSingle(),
    canListPostsOf(viewer, profile.id),
  ]);
  // Row-level security still applies: only posts in spaces the viewer can open are returned.
  const posts = showPosts ? await listPosts({ authorId: profile.id, sort: "new" }) : null;
  const firstName = profile.full_name.split(" ")[0];
  const year = yearLabel(profile.year_of_study);
  const facts = [
    profile.department_name && { icon: Building2, text: profile.department_name },
    year && { icon: GraduationCap, text: year },
    profile.created_at && {
      icon: CalendarDays,
      text: `Joined ${format(new Date(profile.created_at), "MMMM yyyy")}`,
    },
  ].filter(Boolean) as { icon: typeof Building2; text: string }[];

  return (
    <>
      <PageHeader title={profile.full_name} className="sr-only" />
      <BackButton href="/home" className="mb-3" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-[22px] border bg-card shadow-soft">
          <div
            className="h-28 bg-[linear-gradient(120deg,var(--brand-navy),var(--brand-bright))]"
            aria-hidden
          />
          <div className="space-y-5 px-6 pb-7 sm:px-8">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
              <UserAvatar
                name={profile.full_name}
                src={profile.avatar_url}
                size="xl"
                className="ring-4 ring-card"
              />
              {own ? (
                <Link href="/settings/profile" className={buttonVariants({ variant: "outline" })}>
                  <Pencil data-icon="inline-start" />
                  Edit profile
                </Link>
              ) : (
                <ProfileMenu
                  userId={profile.id}
                  name={profile.full_name}
                  blocked={Boolean(block)}
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em]">
                  {profile.full_name}
                </h2>
                {profile.role && profile.role !== "student" && <RoleBadge role={profile.role} />}
                {mentor && <RoleBadge role="mentor" />}
              </div>
              <p className="text-sm font-semibold text-muted-foreground">@{profile.username}</p>
              {profile.bio && (
                <p className="max-w-prose text-[15.5px] text-pretty">{profile.bio}</p>
              )}
            </div>
            {facts.length > 0 && (
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {facts.map((fact) => (
                  <li key={fact.text} className="flex items-center gap-1.5">
                    <fact.icon className="size-4" aria-hidden />
                    {fact.text}
                  </li>
                ))}
              </ul>
            )}
            {own && profile.profile_visibility !== "everyone" && (
              <p className="rounded-xl bg-surface-tint px-3.5 py-2.5 text-sm text-muted-foreground">
                Your profile is limited to{" "}
                {profile.profile_visibility === "department"
                  ? "your department"
                  : "just your name and photo"}
                .{" "}
                <Link
                  href="/settings/privacy"
                  className="font-semibold text-primary hover:underline dark:text-accent-foreground"
                >
                  Change privacy
                </Link>
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          {mentor && (
            <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft">
              <h2 className="text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                Mentoring
              </h2>
              <p className="font-semibold text-pretty">{mentor.headline}</p>
              {mentor.subjects.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Mentoring subjects">
                  {mentor.subjects.map((s) => (
                    <li key={s}>
                      <CategoryChip tint="blue">{s}</CategoryChip>
                    </li>
                  ))}
                </ul>
              )}
              <MentorAvailability mentor={mentor} />
              {own ? (
                <Link
                  href="/settings/mentor"
                  className="text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
                >
                  Edit mentor profile
                </Link>
              ) : (
                <RequestMentorButton
                  mentorId={mentor.userId}
                  mentorName={mentor.name}
                  myRequestStatus={mentor.myRequestStatus}
                  blockReason={mentor.blockReason}
                />
              )}
            </section>
          )}
          <TagCard title="Interests" tags={profile.interests ?? []} tint="blue" />
          <TagCard title="Can help with" tags={profile.expertise ?? []} tint="emerald" />
        </aside>

        {posts && (
          <section className="lg:col-span-2" aria-labelledby="posts-title">
            <Eyebrow className="mb-3">Posts</Eyebrow>
            <h2 id="posts-title" className="sr-only">
              Posts
            </h2>
            {posts.items.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title={own ? "You haven't posted yet" : `No posts from ${firstName} to show`}
                description={
                  own
                    ? "Your discussions and questions will show up here."
                    : "Their discussions and questions in spaces you can open show up here."
                }
                action={
                  own ? (
                    <Link href="/posts/new" className={buttonVariants({ variant: "outline" })}>
                      Create a post
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <PostFeed
                initial={posts.items}
                initialHasMore={posts.hasMore}
                query={{ scope: "author", authorId: profile.id, sort: "new" }}
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}

function TagCard({
  title,
  tags,
  tint,
}: {
  title: string;
  tags: string[];
  tint: "blue" | "emerald";
}) {
  return (
    <section className="rounded-[22px] border bg-card p-5 shadow-soft">
      <h2 className="mb-3 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h2>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <CategoryChip tint={tint} className={cn("h-7 px-3 text-[13px]")}>
                {tag}
              </CategoryChip>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing added yet.</p>
      )}
    </section>
  );
}
