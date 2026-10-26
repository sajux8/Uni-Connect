import { CircleCheck, Lock, MessageSquare, Pin, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { SpaceIcon } from "@/components/community/space-icon";
import { CategoryChip, RoleBadge } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { PostListItem } from "@/server/queries/posts";

/**
 * PostCard / QuestionCard. Counts sit quietly in the footer; questions
 * show answers and helpful votes, and a green "Solved" state once an answer is accepted.
 */
export function PostCard({ post, showSpace = true }: { post: PostListItem; showSpace?: boolean }) {
  const question = post.type === "question";

  return (
    <article
      aria-labelledby={`post-${post.id}-title`}
      className="group relative rounded-[22px] border bg-card p-5 shadow-soft transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-lift sm:p-6"
    >
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          {showSpace && (
            <Link
              href={`/spaces/${post.space.slug}`}
              className="relative z-10 -my-2 inline-flex items-center gap-1.5 py-2 font-bold text-foreground hover:text-primary"
            >
              <SpaceIcon
                icon={post.space.icon}
                type={post.space.type}
                size="sm"
                className="size-5 rounded-md [&_svg]:size-3"
              />
              {post.space.name}
            </Link>
          )}
          {showSpace && <span aria-hidden>·</span>}
          <CategoryChip tint={question ? "blue" : "zinc"}>
            {question ? "Question" : "Discussion"}
          </CategoryChip>
          {post.space.type === "batch" && post.audience === "batch" && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Lock className="size-3.5" aria-hidden /> Batch only
            </span>
          )}
          {post.isPinned && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary dark:text-accent-foreground">
              <Pin className="size-3.5" aria-hidden /> Pinned
            </span>
          )}
          {post.isLocked && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Lock className="size-3.5" aria-hidden /> Locked
            </span>
          )}
          {question && post.isSolved && (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <CircleCheck className="size-3.5" aria-hidden /> Solved
            </span>
          )}
        </div>

        <h3
          id={`post-${post.id}-title`}
          className="text-[17px] leading-snug font-extrabold tracking-tight text-balance"
        >
          <Link
            href={`/posts/${post.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-[22px] focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p className="line-clamp-2 text-[14.5px] text-muted-foreground">{post.excerpt}</p>
        )}

        {post.tags.length > 0 && (
          <ul className="relative z-10 flex flex-wrap gap-1.5" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/questions?tag=${tag.slug}`}
                  className="inline-flex h-6 items-center rounded-full bg-accent px-2.5 text-xs font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  #{tag.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[13px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-2">
            <UserAvatar
              name={post.author?.fullName ?? "Former member"}
              src={post.author?.avatarUrl}
              size="xs"
            />
            <span
              className={cn(
                "truncate font-semibold text-foreground",
                post.author?.isClassRep && "text-rep-foreground",
              )}
            >
              {post.author?.fullName ?? "Former member"}
            </span>
            {post.author && post.author.role !== "student" && <RoleBadge role={post.author.role} />}
            {post.author?.isClassRep && <RoleBadge role="rep" />}
          </span>
          <RelativeTime date={post.lastActivityAt} />
          <span className="ml-auto inline-flex items-center gap-3">
            {(question ? post.helpfulCount : post.voteScore) > 0 && (
              <span
                className="inline-flex items-center gap-1"
                aria-label={question ? `${post.helpfulCount} helpful` : `${post.voteScore} upvotes`}
              >
                <ThumbsUp className="size-3.5" aria-hidden />{" "}
                {question ? post.helpfulCount : post.voteScore}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1",
                question && post.isSolved && "font-semibold text-success",
              )}
              aria-label={`${post.replyCount} ${replyWord(question, post.replyCount)}`}
            >
              <MessageSquare className="size-3.5" aria-hidden /> {post.replyCount}
              <span className="hidden sm:inline">{replyWord(question, post.replyCount)}</span>
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

function replyWord(question: boolean, count: number) {
  if (question) return count === 1 ? "answer" : "answers";
  return count === 1 ? "reply" : "replies";
}
