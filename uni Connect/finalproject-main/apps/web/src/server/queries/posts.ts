import "server-only";

import type { PostType, SpaceType } from "@/lib/community";
import { excerpt } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import type { FeedSort, QuestionFilter } from "@/lib/validation/posts";
import type { Enums } from "@/types/database";

export interface PersonRef {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  role: Enums<"user_role">;
  /** Class reps are highlighted in gold. */
  isClassRep?: boolean;
}

export type PostAudience = "batch" | "department";

export interface PostListItem {
  id: string;
  type: PostType;
  title: string;
  excerpt: string;
  isPinned: boolean;
  isLocked: boolean;
  status: Enums<"content_status">;
  replyCount: number;
  helpfulCount: number;
  voteScore: number;
  isSolved: boolean;
  lastActivityAt: string;
  createdAt: string;
  author: PersonRef | null;
  space: { id: string; slug: string; name: string; type: SpaceType; icon: string | null };
  tags: { id: string; name: string; slug: string }[];
  /** Batch spaces only: whether the post stays in the batch or is shared with the department. */
  audience: PostAudience;
}

const LIST_COLUMNS = `
  id, type, title, body_text, is_pinned, is_locked, status, reply_count, helpful_count, vote_score, audience,
  accepted_reply_id, last_activity_at, created_at,
  author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url, role),
  space:spaces!posts_space_id_fkey(id, slug, name, type, icon),
  post_tags(tags(id, name, slug))
`;

type ListRow = {
  id: string;
  type: PostType;
  title: string;
  body_text: string;
  is_pinned: boolean;
  is_locked: boolean;
  status: Enums<"content_status">;
  reply_count: number;
  helpful_count: number;
  vote_score: number;
  audience: string;
  accepted_reply_id: string | null;
  last_activity_at: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    role: Enums<"user_role">;
  } | null;
  space: { id: string; slug: string; name: string; type: SpaceType; icon: string | null };
  post_tags: { tags: { id: string; name: string; slug: string } | null }[];
};

export function toPerson(p: ListRow["author"]): PersonRef | null {
  return p
    ? {
        id: p.id,
        fullName: p.full_name,
        username: p.username,
        avatarUrl: p.avatar_url,
        role: p.role,
      }
    : null;
}

function toListItem(row: ListRow): PostListItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    excerpt: excerpt(row.body_text),
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    status: row.status,
    replyCount: row.reply_count,
    helpfulCount: row.helpful_count,
    voteScore: row.vote_score,
    isSolved: row.accepted_reply_id !== null,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    author: toPerson(row.author),
    space: row.space,
    tags: row.post_tags.map((pt) => pt.tags).filter((t): t is NonNullable<typeof t> => Boolean(t)),
    audience: row.audience === "batch" ? "batch" : "department",
  };
}

/** Marks authors who are currently a class rep, so they can be highlighted. */
async function markClassReps(people: (PersonRef | null)[]): Promise<void> {
  const ids = [...new Set(people.filter((p): p is PersonRef => p !== null).map((p) => p.id))];
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { data } = await supabase.from("batches").select("rep_id").in("rep_id", ids);
  const reps = new Set((data ?? []).map((b) => b.rep_id));
  for (const p of people) if (p) p.isClassRep = reps.has(p.id);
}

export interface ListPostsOptions {
  /** Restrict to these spaces (an empty array returns nothing). */
  spaceIds?: string[];
  /** Also include posts these (batch) spaces shared with the whole department. */
  sharedFromSpaceIds?: string[];
  type?: PostType;
  filter?: QuestionFilter;
  sort?: FeedSort;
  tagSlug?: string;
  authorId?: string;
  /** The viewer, for the "mine" filter. */
  viewerId?: string;
  /** Show pinned posts first (space pages). */
  pinnedFirst?: boolean;
  offset?: number;
  limit?: number;
}

export const PAGE_SIZE = 15;

export async function listPosts(
  options: ListPostsOptions,
): Promise<{ items: PostListItem[]; hasMore: boolean }> {
  const limit = options.limit ?? PAGE_SIZE;
  const offset = options.offset ?? 0;
  if (options.spaceIds && options.spaceIds.length === 0) return { items: [], hasMore: false };

  const supabase = await createClient();
  let query = supabase.from("posts").select(LIST_COLUMNS).eq("status", "visible");

  if (options.spaceIds && options.sharedFromSpaceIds?.length) {
    query = query.or(
      `space_id.in.(${options.spaceIds.join(",")}),and(space_id.in.(${options.sharedFromSpaceIds.join(",")}),audience.eq.department)`,
    );
  } else if (options.spaceIds) {
    query = query.in("space_id", options.spaceIds);
  }
  if (options.type) query = query.eq("type", options.type);
  if (options.authorId) query = query.eq("author_id", options.authorId);

  switch (options.filter) {
    case "unanswered":
      query = query.eq("type", "question").eq("reply_count", 0).is("accepted_reply_id", null);
      break;
    case "solved":
      query = query.eq("type", "question").not("accepted_reply_id", "is", null);
      break;
    case "mine":
      if (options.viewerId) query = query.eq("author_id", options.viewerId);
      break;
  }

  if (options.tagSlug) {
    const { data: tag } = await supabase
      .from("tags")
      .select("id")
      .eq("slug", options.tagSlug)
      .maybeSingle();
    if (!tag) return { items: [], hasMore: false };
    const { data: tagged } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tag.id)
      .limit(1000);
    const ids = (tagged ?? []).map((t) => t.post_id);
    if (ids.length === 0) return { items: [], hasMore: false };
    query = query.in("id", ids);
  }

  if (options.pinnedFirst) query = query.order("is_pinned", { ascending: false });
  switch (options.sort ?? "latest") {
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "top":
      query = query
        .order("vote_score", { ascending: false })
        .order("helpful_count", { ascending: false });
      break;
    default:
      query = query.order("last_activity_at", { ascending: false });
  }
  query = query.order("id").range(offset, offset + limit);

  const { data, error } = await query;
  if (error) {
    console.error("listPosts", error);
    throw new Error("Couldn't load posts.");
  }
  const rows = (data ?? []) as unknown as ListRow[];
  const items = rows.slice(0, limit).map(toListItem);
  await markClassReps(items.map((i) => i.author));
  return { items, hasMore: rows.length > limit };
}

/**
 * Whether the viewer may see a member's posts listed on their profile. This follows the member's
 * profile visibility, like the other profile details: always on their own profile, otherwise only
 * when the profile is open to everyone or to the viewer's department.
 */
export async function canListPostsOf(
  viewer: { id: string; departmentId: string | null },
  authorId: string,
): Promise<boolean> {
  if (viewer.id === authorId) return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_cards")
    .select("department_id, profile_visibility")
    .eq("id", authorId)
    .maybeSingle();
  if (!data) return false;
  if (data.profile_visibility === "everyone") return true;
  return (
    data.profile_visibility === "department" &&
    data.department_id !== null &&
    data.department_id === viewer.departmentId
  );
}

// Thread ------------------------------------------------------------------------------

export interface PostDetail extends PostListItem {
  bodyHtml: string;
  acceptedReplyId: string | null;
  editedAt: string | null;
  viewer: {
    hasVoted: boolean;
    isFollowing: boolean;
    isAuthor: boolean;
    isModerator: boolean;
    canReply: boolean;
  };
}

export interface ReplyItem {
  id: string;
  parentReplyId: string | null;
  bodyHtml: string;
  status: Enums<"content_status">;
  helpfulCount: number;
  editedAt: string | null;
  createdAt: string;
  author: PersonRef | null;
  viewerFoundHelpful: boolean;
}

export async function getPost(id: string, viewerId: string): Promise<PostDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(`${LIST_COLUMNS}, body_html, edited_at`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as ListRow & { body_html: string; edited_at: string | null };

  const [vote, follow, moderator] = await Promise.all([
    supabase
      .from("post_votes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", viewerId)
      .maybeSingle(),
    supabase
      .from("post_follows")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", viewerId)
      .maybeSingle(),
    supabase.rpc("is_space_moderator", { p_space_id: row.space.id }),
  ]);

  const item = toListItem(row);
  await markClassReps([item.author]);
  return {
    ...item,
    bodyHtml: row.body_html,
    acceptedReplyId: row.accepted_reply_id,
    editedAt: row.edited_at,
    viewer: {
      hasVoted: Boolean(vote.data),
      isFollowing: Boolean(follow.data),
      isAuthor: row.author?.id === viewerId,
      isModerator: Boolean(moderator.data),
      // Anyone who can read a thread can reply (open spaces join you on your first reply).
      canReply: !row.is_locked,
    },
  };
}

export async function getReplies(postId: string, viewerId: string): Promise<ReplyItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("replies")
    .select(
      "id, parent_reply_id, body_html, status, helpful_count, edited_at, created_at, author:profiles!replies_author_id_fkey(id, full_name, username, avatar_url, role)",
    )
    .eq("post_id", postId)
    .order("created_at")
    .limit(500);
  const replies = data ?? [];
  if (replies.length === 0) return [];

  const { data: votes } = await supabase
    .from("reply_votes")
    .select("reply_id")
    .eq("user_id", viewerId)
    .in(
      "reply_id",
      replies.map((r) => r.id),
    );
  const voted = new Set((votes ?? []).map((v) => v.reply_id));

  const items = replies.map((r) => ({
    id: r.id,
    parentReplyId: r.parent_reply_id,
    bodyHtml: r.body_html,
    status: r.status,
    helpfulCount: r.helpful_count,
    editedAt: r.edited_at,
    createdAt: r.created_at,
    author: toPerson(r.author),
    viewerFoundHelpful: voted.has(r.id),
  }));
  await markClassReps(items.map((r) => r.author));
  return items;
}
