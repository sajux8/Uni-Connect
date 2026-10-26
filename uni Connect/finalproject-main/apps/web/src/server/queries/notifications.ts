import "server-only";

import { cache } from "react";

import { typesForTab, type NotificationTab } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { name: string; avatarUrl: string | null } | null;
}

const COLUMNS =
  "id, type, title, body, link, read_at, created_at, profiles!notifications_actor_id_fkey(full_name, avatar_url)";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

function toItem(row: Row): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
    actor: row.profiles
      ? { name: row.profiles.full_name, avatarUrl: row.profiles.avatar_url }
      : null,
  };
}

export async function listNotifications(
  userId: string,
  options: { tab?: NotificationTab; limit?: number } = {},
): Promise<{ items: NotificationItem[]; hasMore: boolean }> {
  const limit = options.limit ?? 30;
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (options.tab === "unread") query = query.is("read_at", null);
  const types = typesForTab(options.tab ?? "all");
  if (types.length > 0) query = query.in("type", types);

  const { data, error } = await query;
  if (error) {
    console.error("listNotifications", error);
    throw new Error("Couldn't load notifications.");
  }
  return { items: data.slice(0, limit).map(toItem), hasMore: data.length > limit };
}

export const unreadNotificationCount = cache(async (userId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("unreadNotificationCount", error);
    return 0;
  }
  return count ?? 0;
});

export interface PreferenceRow {
  type: string;
  inApp: boolean;
  email: boolean;
  emailAvailable: boolean;
  locked: boolean;
}

/** Every notification type with the user's effective settings (defaults where unset). */
export async function getNotificationPreferences(userId: string): Promise<PreferenceRow[]> {
  const supabase = await createClient();
  const [{ data: types }, { data: prefs }] = await Promise.all([
    supabase
      .from("notification_types")
      .select("type, in_app_default, email_default, email_available, locked")
      .order("sort_order"),
    supabase.from("notification_preferences").select("type, in_app, email").eq("user_id", userId),
  ]);
  const mine = new Map((prefs ?? []).map((p) => [p.type, p]));
  return (types ?? []).map((t) => {
    const p = mine.get(t.type);
    return {
      type: t.type,
      inApp: t.locked || (p?.in_app ?? t.in_app_default),
      email: t.email_available && (t.locked || (p?.email ?? t.email_default)),
      emailAvailable: t.email_available,
      locked: t.locked,
    };
  });
}
