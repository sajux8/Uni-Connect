"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import {
  MIN_POST_BODY,
  parseQuestionFilter,
  parseSort,
  postSchema,
  type PostInput,
} from "@/lib/validation/posts";
import { feedSpaceIds } from "@/server/queries/feed";
import { ensureMembership } from "@/server/queries/membership";
import {
  canListPostsOf,
  listPosts,
  type ListPostsOptions,
  type PostListItem,
} from "@/server/queries/posts";

const id = z.uuid();

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function checkBody(html: string) {
  const body = sanitizeRichText(html);
  if (body.text.length < MIN_POST_BODY) {
    return { body, error: `Add a bit more detail (at least ${MIN_POST_BODY} characters).` };
  }
  return { body, error: null };
}

export async function createPost(input: PostInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireApproved();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const { body, error: bodyError } = checkBody(parsed.data.bodyHtml);
  if (bodyError) return fail(bodyError, { bodyHtml: [bodyError] });

  const supabase = await createClient();
  const membershipError = await ensureMembership(supabase, parsed.data.spaceId, user.id);
  if (membershipError) return fail(membershipError, { spaceId: [membershipError] });

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      space_id: parsed.data.spaceId,
      author_id: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      body_html: body.html,
      body_text: body.text,
      // Ignored outside batch spaces (the database makes those department-wide).
      audience: parsed.data.audience ?? "batch",
    })
    .select("id")
    .single();
  if (error || !post) {
    console.error("createPost", error);
    return fail(databaseErrorMessage(error));
  }

  if (parsed.data.tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("post_tags")
      .insert(parsed.data.tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })));
    if (tagError) console.error("createPost tags", tagError);
  }

  revalidatePath("/", "layout");
  return ok(
    { id: post.id },
    parsed.data.type === "question" ? "Question posted." : "Post published.",
  );
}

export async function updatePost(
  postId: string,
  input: PostInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireApproved();
  if (!id.safeParse(postId).success) return fail("That post doesn't exist.");
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const { body, error: bodyError } = checkBody(parsed.data.bodyHtml);
  if (bodyError) return fail(bodyError, { bodyHtml: [bodyError] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({
      ...(parsed.data.audience ? { audience: parsed.data.audience } : {}),
      title: parsed.data.title,
      body_html: body.html,
      body_text: body.text,
      edited_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("updatePost", error);
    return fail(
      error ? databaseErrorMessage(error) : "You can't edit this post (it may be locked).",
    );
  }

  // Replace the tags.
  await supabase.from("post_tags").delete().eq("post_id", postId);
  if (parsed.data.tagIds.length > 0) {
    await supabase
      .from("post_tags")
      .insert(parsed.data.tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
  }

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/", "layout");
  return ok({ id: postId }, "Changes saved.");
}

export async function deletePost(postId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(postId).success) return fail("That post doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_content", { p_kind: "post", p_id: postId });
  if (error) {
    console.error("deletePost", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Post deleted.");
}

export async function togglePostVote(postId: string, vote: boolean): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(postId).success) return fail("That post doesn't exist.");
  const supabase = await createClient();
  const { error } = vote
    ? await supabase.from("post_votes").insert({ post_id: postId, user_id: user.id })
    : await supabase.from("post_votes").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error && error.code !== "23505") {
    return fail(
      error.code === "42501" ? "You can't vote on your own post." : databaseErrorMessage(error),
    );
  }
  revalidatePath(`/posts/${postId}`);
  return ok();
}

export async function togglePostFollow(postId: string, follow: boolean): Promise<ActionResult> {
  const user = await requireApproved();
  if (!id.safeParse(postId).success) return fail("That post doesn't exist.");
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("post_follows").insert({ post_id: postId, user_id: user.id })
    : await supabase.from("post_follows").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error && error.code !== "23505") return fail(databaseErrorMessage(error));
  return ok(
    undefined,
    follow ? "You'll be notified about new replies." : "You won't be notified about this thread.",
  );
}

const moderateSchema = z.object({
  action: z.enum(["pin", "unpin", "lock", "unlock", "hide", "restore", "move"]),
  reason: z.string().trim().max(500).optional(),
  spaceId: z.uuid().optional(),
});

export async function moderatePost(
  postId: string,
  input: { action: string; reason?: string; spaceId?: string },
): Promise<ActionResult> {
  await requireApproved();
  const parsed = moderateSchema.safeParse(input);
  if (!parsed.success || !id.safeParse(postId).success) return fail("That action isn't valid.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_post", {
    p_post_id: postId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
    p_space_id: parsed.data.spaceId,
  });
  if (error) {
    console.error("moderatePost", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/", "layout");
  const messages: Record<string, string> = {
    pin: "Post pinned.",
    unpin: "Post unpinned.",
    lock: "Thread locked.",
    unlock: "Thread unlocked.",
    hide: "Post hidden.",
    restore: "Post restored.",
    move: "Post moved.",
  };
  return ok(undefined, messages[parsed.data.action]);
}

/** "Load more" for every post list. Same filters as the page that rendered the first batch. */
export async function loadMorePosts(options: {
  scope: "space" | "questions" | "following" | "latest" | "foryou" | "author";
  spaceId?: string;
  authorId?: string;
  type?: "discussion" | "question";
  filter?: string;
  sort?: string;
  tag?: string;
  offset: number;
}): Promise<ActionResult<{ items: PostListItem[]; hasMore: boolean }>> {
  const user = await requireApproved();
  const base: ListPostsOptions = {
    sort: parseSort(options.sort),
    filter: parseQuestionFilter(options.filter),
    tagSlug: options.tag || undefined,
    viewerId: user.id,
    offset: Math.max(0, Math.floor(options.offset)),
  };

  try {
    if (options.scope === "space") {
      if (!options.spaceId || !id.safeParse(options.spaceId).success)
        return fail("That space doesn't exist.");
      return ok(
        await listPosts({
          ...base,
          spaceIds: [options.spaceId],
          type: options.type,
          pinnedFirst: true,
        }),
      );
    }
    if (options.scope === "author") {
      if (!options.authorId || !id.safeParse(options.authorId).success)
        return fail("That profile doesn't exist.");
      if (!(await canListPostsOf(user, options.authorId))) return ok({ items: [], hasMore: false });
      return ok(await listPosts({ ...base, authorId: options.authorId }));
    }
    if (options.scope === "questions") return ok(await listPosts({ ...base, type: "question" }));
    if (options.scope === "latest") return ok(await listPosts(base));
    return ok(await listPosts({ ...base, spaceIds: await feedSpaceIds(user.id, options.scope) }));
  } catch {
    return fail("Couldn't load more posts. Please try again.");
  }
}
