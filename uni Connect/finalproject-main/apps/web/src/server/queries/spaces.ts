import "server-only";

import { cache } from "react";

import type { NotifyLevel, SpaceType } from "@/lib/community";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export interface SpaceSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: SpaceType;
  icon: string | null;
  joinPolicy: Enums<"join_policy">;
  memberCount: number;
  departmentId: string | null;
  /** Batch spaces sit under their department's space. */
  parentId: string | null;
  /** The viewer's membership, if any. */
  membership: {
    status: Enums<"member_status">;
    role: Enums<"member_role">;
    notifyLevel: NotifyLevel;
  } | null;
}

const SPACE_COLUMNS =
  "id, slug, name, description, type, icon, join_policy, member_count, department_id, parent_id, rules, created_at";

type SpaceRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: SpaceType;
  icon: string | null;
  join_policy: Enums<"join_policy">;
  member_count: number;
  department_id: string | null;
  parent_id: string | null;
};

function toSummary(
  row: SpaceRow,
  memberships: Map<string, SpaceSummary["membership"]>,
): SpaceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    type: row.type,
    icon: row.icon,
    joinPolicy: row.join_policy,
    memberCount: row.member_count,
    departmentId: row.department_id,
    parentId: row.parent_id,
    membership: memberships.get(row.id) ?? null,
  };
}

/** The viewer's memberships, keyed by space id (one query per request). */
export const myMemberships = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select("space_id, status, role, notify_level")
    .eq("user_id", userId);
  return new Map<string, SpaceSummary["membership"]>(
    (data ?? []).map((m) => [
      m.space_id,
      { status: m.status, role: m.role, notifyLevel: m.notify_level },
    ]),
  );
});

export async function listSpaces(userId: string): Promise<SpaceSummary[]> {
  const supabase = await createClient();
  const [{ data, error }, memberships] = await Promise.all([
    // Batches are listed on their department's page, not in the directory.
    supabase.from("spaces").select(SPACE_COLUMNS).neq("type", "batch").order("type").order("name"),
    myMemberships(userId),
  ]);
  if (error) throw new Error("Couldn't load spaces.");
  return (data ?? []).map((row) => toSummary(row, memberships));
}

/** Spaces the viewer is an active member of (sidebar, composer, onboarding). */
export const listJoinedSpaces = cache(async (userId: string): Promise<SpaceSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select(`status, role, notify_level, spaces!inner(${SPACE_COLUMNS})`)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at");
  return (data ?? []).map((m) =>
    toSummary(
      m.spaces,
      new Map([[m.spaces.id, { status: m.status, role: m.role, notifyLevel: m.notify_level }]]),
    ),
  );
});

export interface SpaceDetail extends SpaceSummary {
  rules: string | null;
  createdAt: string;
  canViewContent: boolean;
  canPost: boolean;
  isModerator: boolean;
  /** A batch space's department space. */
  parent: { slug: string; name: string } | null;
  /** A department space's batch spaces (names only; their posts stay private). */
  batches: { id: string; slug: string; name: string; memberCount: number; mine: boolean }[];
}

export async function getSpace(slug: string, userId: string): Promise<SpaceDetail | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("spaces")
    .select(SPACE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (!row) return null;

  const [memberships, canView, isModerator] = await Promise.all([
    myMemberships(userId),
    supabase.rpc("can_view_space", { p_space_id: row.id }),
    supabase.rpc("is_space_moderator", { p_space_id: row.id }),
  ]);
  const summary = toSummary(row, memberships);
  const automatic = row.type === "department" || row.type === "batch";
  const [{ data: parent }, { data: children }] = await Promise.all([
    row.parent_id
      ? supabase.from("spaces").select("slug, name").eq("id", row.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.type === "department"
      ? supabase
          .from("spaces")
          .select("id, slug, name, member_count")
          .eq("parent_id", row.id)
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);
  return {
    ...summary,
    rules: row.rules,
    createdAt: row.created_at,
    canViewContent: Boolean(canView.data),
    // Department and batch spaces need no joining: belonging is enough.
    canPost: summary.membership?.status === "active" || (automatic && Boolean(canView.data)),
    isModerator: Boolean(isModerator.data),
    parent: parent ?? null,
    batches: (children ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      memberCount: c.member_count,
      mine: memberships.get(c.id)?.status === "active",
    })),
  };
}

export interface MemberRow {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  role: Enums<"member_role">;
  status: Enums<"member_status">;
  joinedAt: string;
}

export async function listMembers(
  spaceId: string,
  status: "active" | "pending",
): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select(
      "user_id, role, status, joined_at, profiles!space_members_user_id_fkey(full_name, username, avatar_url)",
    )
    .eq("space_id", spaceId)
    .eq("status", status)
    .order("role", { ascending: false })
    .order("joined_at")
    .limit(200);
  return (data ?? [])
    .filter((m) => m.profiles)
    .map((m) => ({
      userId: m.user_id,
      fullName: m.profiles!.full_name,
      username: m.profiles!.username,
      avatarUrl: m.profiles!.avatar_url,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at,
    }));
}

export async function listTags(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id, name, slug").order("name");
  return data ?? [];
}
