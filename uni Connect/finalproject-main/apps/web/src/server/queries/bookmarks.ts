import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type BookmarkTarget = Enums<"bookmark_target">;

export interface BookmarkItem {
  type: BookmarkTarget;
  id: string;
  title: string;
  url: string;
  detail: string;
  savedAt: string;
}

export async function isBookmarked(
  userId: string,
  type: BookmarkTarget,
  id: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("target_id")
    .eq("user_id", userId)
    .eq("target_type", type)
    .eq("target_id", id)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Saved items, newest first. Each target is read through RLS, so anything the user can no
 * longer see (hidden post, archived announcement…) quietly drops out.
 */
export async function listBookmarks(
  userId: string,
  type?: BookmarkTarget,
): Promise<BookmarkItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bookmarks")
    .select("target_type, target_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (type) query = query.eq("target_type", type);
  const { data: marks } = await query;
  if (!marks || marks.length === 0) return [];

  const ids = (t: BookmarkTarget) =>
    marks.filter((m) => m.target_type === t).map((m) => m.target_id);
  const [posts, events, announcements, resources, opportunities] = await Promise.all([
    ids("post").length
      ? supabase
          .from("posts")
          .select("id, title, type, spaces!posts_space_id_fkey(name)")
          .in("id", ids("post"))
          .eq("status", "visible")
      : null,
    ids("event").length
      ? supabase
          .from("events")
          .select("id, title, starts_at, organizing_unit")
          .in("id", ids("event"))
      : null,
    ids("announcement").length
      ? supabase
          .from("announcements")
          .select("id, title, publishing_unit")
          .in("id", ids("announcement"))
          .eq("status", "published")
      : null,
    ids("resource").length
      ? supabase.from("resources").select("id, title, module_code, kind").in("id", ids("resource"))
      : null,
    ids("opportunity").length
      ? supabase.from("opportunities").select("id, title, company").in("id", ids("opportunity"))
      : null,
  ]);

  const found = new Map<string, Omit<BookmarkItem, "savedAt">>();
  for (const p of posts?.data ?? []) {
    found.set(`post:${p.id}`, {
      type: "post",
      id: p.id,
      title: p.title,
      url: `/posts/${p.id}`,
      detail: `${p.type === "question" ? "Question" : "Discussion"} · ${p.spaces?.name ?? ""}`,
    });
  }
  for (const e of events?.data ?? []) {
    found.set(`event:${e.id}`, {
      type: "event",
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      detail: `Event · ${e.organizing_unit}`,
    });
  }
  for (const a of announcements?.data ?? []) {
    found.set(`announcement:${a.id}`, {
      type: "announcement",
      id: a.id,
      title: a.title,
      url: `/announcements/${a.id}`,
      detail: `Announcement · ${a.publishing_unit}`,
    });
  }
  for (const r of resources?.data ?? []) {
    found.set(`resource:${r.id}`, {
      type: "resource",
      id: r.id,
      title: r.title,
      url: `/resources/${r.id}`,
      detail: `Resource${r.module_code ? ` · ${r.module_code}` : r.kind === "link" ? " · Link" : ""}`,
    });
  }

  for (const o of opportunities?.data ?? []) {
    found.set(`opportunity:${o.id}`, {
      type: "opportunity",
      id: o.id,
      title: o.title,
      url: `/careers/${o.id}`,
      detail: `Opportunity · ${o.company}`,
    });
  }

  return marks.flatMap((m) => {
    const item = found.get(`${m.target_type}:${m.target_id}`);
    return item ? [{ ...item, savedAt: m.created_at }] : [];
  });
}
