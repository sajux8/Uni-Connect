"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PostCard } from "@/components/community/post-card";
import { Button } from "@/components/ui/button";
import { loadMorePosts } from "@/server/actions/posts";
import type { PostListItem } from "@/server/queries/posts";

export type FeedQuery = Omit<Parameters<typeof loadMorePosts>[0], "offset">;

/** A list of PostCards with "Load more". */
export function PostFeed({
  initial,
  initialHasMore,
  query,
  showSpace = true,
}: {
  initial: PostListItem[];
  initialHasMore: boolean;
  query: FeedQuery;
  showSpace?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await loadMorePosts({ ...query, offset: items.length });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const seen = new Set(items.map((i) => i.id));
      setItems([...items, ...result.data.items.filter((i) => !seen.has(i.id))]);
      setHasMore(result.data.hasMore);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((post) => (
          <li key={post.id}>
            <PostCard post={post} showSpace={showSpace} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={pending}>
            {pending ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
