import "server-only";

import { cache } from "react";

import type { AnnouncementCategory, PublishStatus } from "@/lib/announcements";
import type { UserRole } from "@/lib/campus";
import { createClient } from "@/lib/supabase/server";
import type { AnnouncementScope } from "@/lib/validation/announcements";

export const ANNOUNCEMENTS_PAGE_SIZE = 15;

export interface AnnouncementListItem {
  id: string;
  title: string;
  excerpt: string;
  category: AnnouncementCategory;
  publishingUnit: string;
  audience: { all: boolean; departmentIds: string[]; years: number[] };
  isPinned: boolean;
  isImportant: boolean;
  publishedAt: string;
  editedAt: string | null;
  publisher: { id: string | null; name: string | null; role: UserRole | null };
  isRead: boolean;
  forMe: boolean;
}

export async function listAnnouncements(options: {
  scope?: AnnouncementScope;
  category?: AnnouncementCategory;
  limit?: number;
  offset?: number;
}): Promise<{ items: AnnouncementListItem[]; hasMore: boolean }> {
  const limit = options.limit ?? ANNOUNCEMENTS_PAGE_SIZE;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_announcements", {
    p_scope: options.scope ?? "all",
    p_category: options.category,
    p_limit: limit + 1,
    p_offset: options.offset ?? 0,
  });
  if (error) {
    console.error("listAnnouncements", error);
    throw new Error("Couldn't load announcements.");
  }
  const items = data.slice(0, limit).map((a): AnnouncementListItem => ({
    id: a.id,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    publishingUnit: a.publishing_unit,
    audience: {
      all: a.audience_all,
      departmentIds: a.audience_department_ids,
      years: a.audience_years,
    },
    isPinned: a.is_pinned,
    isImportant: a.is_important,
    publishedAt: a.published_at,
    editedAt: a.edited_at,
    publisher: { id: a.publisher_id, name: a.publisher_name, role: a.publisher_role },
    isRead: a.is_read,
    forMe: a.for_me,
  }));
  return { items, hasMore: data.length > limit };
}

/** Pinned announcements, newest first (Home shows only the ones aimed at you). */
export async function listPinnedAnnouncements(forMeOnly: boolean): Promise<AnnouncementListItem[]> {
  const { items } = await listAnnouncements({ scope: forMeOnly ? "for_me" : "all", limit: 60 });
  return items.filter((a) => a.isPinned).slice(0, 4);
}

export const unreadAnnouncementCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unread_announcement_count");
  if (error) {
    console.error("unreadAnnouncementCount", error);
    return 0;
  }
  return data;
});

export interface AnnouncementDetail {
  id: string;
  title: string;
  bodyHtml: string;
  category: AnnouncementCategory;
  publishingUnit: string;
  audience: { all: boolean; departmentIds: string[]; years: number[] };
  isPinned: boolean;
  pinnedUntil: string | null;
  isImportant: boolean;
  status: PublishStatus;
  publishAt: string | null;
  publishedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  publisher: {
    id: string | null;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    role: UserRole | null;
  };
}

export async function getAnnouncement(id: string): Promise<AnnouncementDetail | null> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("announcements")
    .select(
      "id, title, body_html, category, publishing_unit, audience_all, audience_department_ids, audience_years, is_pinned, pinned_until, is_important, status, publish_at, published_at, edited_at, created_at, publisher_id, profiles!announcements_publisher_id_fkey(full_name, username, avatar_url, role)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!a) return null;
  const pinnedNow = a.is_pinned && (!a.pinned_until || new Date(a.pinned_until) > new Date());
  return {
    id: a.id,
    title: a.title,
    bodyHtml: a.body_html,
    category: a.category,
    publishingUnit: a.publishing_unit,
    audience: {
      all: a.audience_all,
      departmentIds: a.audience_department_ids,
      years: a.audience_years,
    },
    isPinned: pinnedNow,
    pinnedUntil: a.pinned_until,
    isImportant: a.is_important,
    status: a.status,
    publishAt: a.publish_at,
    publishedAt: a.published_at,
    editedAt: a.edited_at,
    createdAt: a.created_at,
    publisher: {
      id: a.publisher_id,
      name: a.profiles?.full_name ?? null,
      username: a.profiles?.username ?? null,
      avatarUrl: a.profiles?.avatar_url ?? null,
      role: a.profiles?.role ?? null,
    },
  };
}

export interface ManagedAnnouncement {
  id: string;
  title: string;
  status: PublishStatus;
  category: AnnouncementCategory;
  publishingUnit: string;
  isPinned: boolean;
  isImportant: boolean;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  publisherId: string | null;
  publisherName: string | null;
}

/** Staff view (/admin/announcements): drafts and scheduled too. RLS limits organizers to their own. */
export async function listManagedAnnouncements(options: {
  status?: PublishStatus;
  mineOnly?: string;
}): Promise<ManagedAnnouncement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select(
      "id, title, status, category, publishing_unit, is_pinned, is_important, publish_at, published_at, updated_at, publisher_id, profiles!announcements_publisher_id_fkey(full_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (options.status) query = query.eq("status", options.status);
  if (options.mineOnly) query = query.eq("publisher_id", options.mineOnly);
  const { data, error } = await query;
  if (error) {
    console.error("listManagedAnnouncements", error);
    throw new Error("Couldn't load announcements.");
  }
  return data.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    category: a.category,
    publishingUnit: a.publishing_unit,
    isPinned: a.is_pinned,
    isImportant: a.is_important,
    publishAt: a.publish_at,
    publishedAt: a.published_at,
    updatedAt: a.updated_at,
    publisherId: a.publisher_id,
    publisherName: a.profiles?.full_name ?? null,
  }));
}

/** The unit this person last published under (default for the next announcement). */
export async function lastPublishingUnit(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("publishing_unit")
    .eq("publisher_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.publishing_unit ?? null;
}
