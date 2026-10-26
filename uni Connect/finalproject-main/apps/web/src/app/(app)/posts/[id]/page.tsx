import { CircleCheck, EyeOff, Lock, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { RelatedQuestionList } from "@/components/ai/related-questions";
import { ThreadSummaryCard } from "@/components/ai/thread-summary";
import { RelativeTime } from "@/components/community/relative-time";
import { ReplyComposer } from "@/components/community/reply-composer";
import { ReplyItem, type ThreadContext } from "@/components/community/reply-item";
import { RichTextContent } from "@/components/community/rich-text-content";
import { SpaceIcon } from "@/components/community/space-icon";
import { ThreadActions } from "@/components/community/thread-actions";
import { CategoryChip, RoleBadge } from "@/components/shared/badges";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CurrentSpace } from "@/components/layout/current-space";
import { BackButton } from "@/components/shared/back-button";
import { aiConfig, aiConfigured } from "@/lib/ai/config";
import { requireApproved } from "@/lib/auth/session";
import { relatedToPost } from "@/server/ai/retrieve";
import { getThreadSummary } from "@/server/queries/ai";
import { isBookmarked } from "@/server/queries/bookmarks";
import { getPost, getReplies, type ReplyItem as Reply } from "@/server/queries/posts";
import { listSpaces } from "@/server/queries/spaces";
import { cn } from "@/lib/utils";

async function load(id: string, viewerId: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getPost(id, viewerId);
}

export async function generateMetadata({ params }: PageProps<"/posts/[id]">): Promise<Metadata> {
  const user = await requireApproved();
  const post = await load((await params).id, user.id);
  return { title: post?.title ?? "Post" };
}

export default async function Page({ params }: PageProps<"/posts/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const post = await load(id, user.id);
  if (!post || post.status === "deleted") notFound();

  const ai = aiConfigured() && post.status === "visible";
  const [replies, spaces, saved, summary, related] = await Promise.all([
    getReplies(post.id, user.id),
    post.viewer.isModerator ? listSpaces(user.id) : Promise.resolve([]),
    isBookmarked(user.id, "post", post.id),
    ai ? getThreadSummary(post.id) : Promise.resolve(null),
    ai && post.type === "question" ? relatedToPost(post.id, post.title) : Promise.resolve([]),
  ]);
  const visibleReplies = replies.filter((r) => r.status === "visible").length;

  const question = post.type === "question";
  const thread: ThreadContext = {
    postId: post.id,
    isQuestion: question,
    isLocked: post.isLocked,
    viewerId: user.id,
    canAccept: question && (post.viewer.isAuthor || post.viewer.isModerator),
    isModerator: post.viewer.isModerator,
  };

  // Top-level replies: accepted answer first; questions by helpfulness, discussions by time.
  const children = new Map<string, Reply[]>();
  const top: Reply[] = [];
  for (const reply of replies) {
    if (reply.parentReplyId)
      children.set(reply.parentReplyId, [...(children.get(reply.parentReplyId) ?? []), reply]);
    else top.push(reply);
  }
  top.sort((a, b) => {
    if (a.id === post.acceptedReplyId) return -1;
    if (b.id === post.acceptedReplyId) return 1;
    if (question && b.helpfulCount !== a.helpfulCount) return b.helpfulCount - a.helpfulCount;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const visibleTop = top.filter(
    (r) =>
      r.status === "visible" ||
      children.has(r.id) ||
      post.viewer.isModerator ||
      r.author?.id === user.id,
  );
  const replyLabel = question
    ? post.replyCount === 1
      ? "answer"
      : "answers"
    : post.replyCount === 1
      ? "reply"
      : "replies";

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6">
        <CurrentSpace slug={post.space.slug} />
        <div className="flex items-center gap-3">
          <BackButton href={`/spaces/${post.space.slug}`} />
          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-2 text-[13px] font-semibold text-muted-foreground sm:flex"
          >
            <Link href="/spaces" className="-my-2 py-2 hover:text-primary">
              Spaces
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/spaces/${post.space.slug}`}
              className="-my-2 inline-flex items-center gap-1.5 py-2 hover:text-primary"
            >
              <SpaceIcon
                icon={post.space.icon}
                type={post.space.type}
                size="sm"
                className="size-5 rounded-md [&_svg]:size-3"
              />
              {post.space.name}
            </Link>
          </nav>
        </div>

        <article
          className="rounded-[22px] border bg-card p-4 shadow-soft sm:p-8"
          aria-labelledby="post-title"
        >
          {post.status === "hidden" && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm font-semibold text-warning">
              <EyeOff className="size-4" aria-hidden /> Hidden by a moderator. Only you and
              moderators can see it.
            </p>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <CategoryChip tint={question ? "blue" : "zinc"}>
              {question ? "Question" : "Discussion"}
            </CategoryChip>
            {post.isPinned && (
              <span className="font-semibold text-primary dark:text-accent-foreground">
                📌 Pinned
              </span>
            )}
            {question && post.isSolved && (
              <span className="inline-flex items-center gap-1 font-semibold text-success">
                <CircleCheck className="size-3.5" aria-hidden /> Solved
              </span>
            )}
          </div>
          <h1
            id="post-title"
            className="text-[24px] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[28px]"
          >
            {post.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={post.author?.fullName ?? "Former member"}
                src={post.author?.avatarUrl}
                size="md"
              />
              <div className="text-sm">
                <p className="flex items-center gap-1.5">
                  {post.author ? (
                    <Link
                      href={`/u/${post.author.username}`}
                      className={cn(
                        "font-bold hover:text-primary",
                        post.author.isClassRep && "text-rep-foreground",
                      )}
                    >
                      {post.author.fullName}
                    </Link>
                  ) : (
                    <span className="font-bold">Former member</span>
                  )}
                  {post.author && post.author.role !== "student" && (
                    <RoleBadge role={post.author.role} />
                  )}
                  {post.author?.isClassRep && <RoleBadge role="rep" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {question ? "Asked" : "Posted"} <RelativeTime date={post.createdAt} />
                  {post.editedAt && <span> · Edited</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <BookmarkButton type="post" id={post.id} initial={saved} />
              <ThreadActions
                post={{
                  id: post.id,
                  type: post.type,
                  status: post.status,
                  isPinned: post.isPinned,
                  isLocked: post.isLocked,
                  voteScore: post.voteScore,
                  spaceSlug: post.space.slug,
                  viewer: post.viewer,
                }}
                moveTargets={spaces
                  .filter((s) => s.id !== post.space.id)
                  .map((s) => ({ id: s.id, name: s.name }))}
              />
            </div>
          </div>

          <RichTextContent html={post.bodyHtml} className="mt-6" />

          {post.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Tags">
              {post.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    href={`/questions?tag=${tag.slug}`}
                    className="inline-flex h-7 items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                  >
                    #{tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        {ai && visibleReplies >= aiConfig.minRepliesForSummary && (
          <ThreadSummaryCard postId={post.id} replyCount={visibleReplies} initial={summary} />
        )}

        <section aria-labelledby="replies-title" className="space-y-4">
          <h2 id="replies-title" className="flex items-center gap-2 text-[18px] font-extrabold">
            <MessageSquare className="size-5 text-primary" aria-hidden />
            {post.replyCount} {replyLabel}
          </h2>

          {visibleTop.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={question ? "No answers yet" : "No replies yet"}
              description={
                question
                  ? "Know the answer? Help a fellow student below."
                  : "Start the conversation below."
              }
            />
          ) : (
            <ul className="space-y-4">
              {visibleTop.map((reply) => (
                <li key={reply.id}>
                  <ReplyItem
                    reply={reply}
                    thread={thread}
                    accepted={reply.id === post.acceptedReplyId}
                  >
                    {(children.get(reply.id) ?? []).map((child) => (
                      <ReplyItem
                        key={child.id}
                        reply={child}
                        thread={thread}
                        accepted={false}
                        nested
                      />
                    ))}
                  </ReplyItem>
                </li>
              ))}
            </ul>
          )}

          {post.isLocked ? (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden /> This thread is locked. No new replies can be
              added.
            </p>
          ) : post.status === "visible" ? (
            <div className="rounded-[22px] border bg-card p-5 shadow-soft">
              <h3 className="mb-3 text-[15px] font-extrabold">
                {question ? "Your answer" : "Add a reply"}
              </h3>
              <ReplyComposer
                postId={post.id}
                placeholder={question ? "Share what you know…" : "Write a reply…"}
              />
            </div>
          ) : null}
        </section>

        {related.length > 0 && (
          <section
            aria-labelledby="related-title"
            className="rounded-[22px] border bg-card p-5 shadow-soft"
          >
            <h2 id="related-title" className="mb-2 text-[15px] font-extrabold">
              Related questions
            </h2>
            <RelatedQuestionList questions={related} />
          </section>
        )}
      </div>
    </>
  );
}
