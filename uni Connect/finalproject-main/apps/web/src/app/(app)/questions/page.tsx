import { CircleHelp, PenSquare, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PostFeed } from "@/components/community/post-feed";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { parseQuestionFilter, parseSort } from "@/lib/validation/posts";
import { listPosts } from "@/server/queries/posts";
import { listTags } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/questions"].title };

const FILTER_LABELS = {
  all: "All",
  unanswered: "Unanswered",
  solved: "Solved",
  mine: "Mine",
} as const;

export default async function Page({ searchParams }: PageProps<"/questions">) {
  const user = await requireApproved();
  const params = await searchParams;
  const filter = parseQuestionFilter(params.filter);
  const sort = parseSort(params.sort);
  const tags = await listTags();
  const tag = tags.find((t) => t.slug === params.tag);
  const current = {
    filter: filter === "all" ? undefined : filter,
    sort: sort === "latest" ? undefined : sort,
    tag: tag?.slug,
  };

  const { items, hasMore } = await listPosts({
    type: "question",
    filter,
    sort,
    tagSlug: tag?.slug,
    viewerId: user.id,
  });

  return (
    <>
      <PageHeader
        title="Questions & answers"
        description="Every question across your spaces. Help someone out, or find an answer that's already been given."
        actions={
          <Link href="/posts/new?type=question" className={buttonVariants()}>
            <PenSquare data-icon="inline-start" /> Ask a question
          </Link>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterTabs
            label="Question filter"
            items={(Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[]).map((f) => ({
              href: withParams("/questions", current, { filter: f === "all" ? undefined : f }),
              label: FILTER_LABELS[f],
              active: filter === f,
            }))}
          />
          <FilterTabs
            label="Sort"
            items={(["latest", "new", "top"] as const).map((s) => ({
              href: withParams("/questions", current, { sort: s === "latest" ? undefined : s }),
              label: { latest: "Active", new: "Newest", top: "Top" }[s],
              active: sort === s,
            }))}
          />
        </div>
        {tag && (
          <p className="flex items-center gap-2 text-sm">
            Tagged
            <Link
              href={withParams("/questions", current, { tag: undefined })}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground"
              aria-label={`Remove tag filter ${tag.name}`}
            >
              #{tag.name} <X className="size-3.5" aria-hidden />
            </Link>
          </p>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title={
            filter === "unanswered"
              ? "No unanswered questions 🎉"
              : filter === "mine"
                ? "You haven't asked anything yet"
                : "No questions here yet"
          }
          description={
            filter === "unanswered"
              ? "Everyone's been helped. Browse all questions to find something to add to."
              : "Ask the first one. Seniors and classmates can answer."
          }
          action={
            <Link
              href={filter === "unanswered" ? "/questions" : "/posts/new?type=question"}
              className={buttonVariants({ variant: "outline" })}
            >
              {filter === "unanswered" ? "Browse all questions" : "Ask a question"}
            </Link>
          }
        />
      ) : (
        <PostFeed
          key={`${filter}-${sort}-${tag?.slug ?? ""}`}
          initial={items}
          initialHasMore={hasMore}
          query={{ scope: "questions", filter, sort, tag: tag?.slug }}
        />
      )}
    </>
  );
}
