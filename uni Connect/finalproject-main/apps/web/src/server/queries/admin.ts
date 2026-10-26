import "server-only";

import type { AccountStatus, UserRole } from "@/lib/campus";
import type {
  ModerationActionType,
  ReportReason,
  ReportStatus,
  ReportTarget,
} from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";

// Dashboard ---------------------------------------------------------------------------------

export interface AdminStats {
  pendingApprovals: number;
  openReports: number;
  pendingResources: number;
  pendingDeletions: number;
  newUsers7d: number;
  members: number;
  posts7d: number;
  replies7d: number;
  upcomingEvents: number;
  activeMentorships: number;
}

export async function getAdminStats(): Promise<AdminStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats").maybeSingle();
  if (error || !data) {
    if (error) console.error("getAdminStats", error);
    return null;
  }
  return {
    pendingApprovals: data.pending_approvals,
    openReports: data.open_reports,
    pendingResources: data.pending_resources,
    pendingDeletions: data.pending_deletions,
    newUsers7d: data.new_users_7d,
    members: data.members,
    posts7d: data.posts_7d,
    replies7d: data.replies_7d,
    upcomingEvents: data.upcoming_events,
    activeMentorships: data.active_mentorships,
  };
}

export interface WeekActivity {
  weekStart: string;
  posts: number;
  replies: number;
  newMembers: number;
  registrations: number;
}

export async function getWeeklyActivity(weeks = 8): Promise<WeekActivity[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_weekly_activity", { p_weeks: weeks });
  return (data ?? []).map((w) => ({
    weekStart: w.week_start,
    posts: w.posts,
    replies: w.replies,
    newMembers: w.new_members,
    registrations: w.registrations,
  }));
}

// Reports -------------------------------------------------------------------------------------

export interface ReportSummary {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  handledAt: string | null;
  snapshot: { title?: string; excerpt?: string; link?: string | null; author_name?: string | null };
  reporter: { id: string | null; name: string | null };
  authorId: string | null;
  spaceId: string | null;
  action: ModerationActionType | null;
  resolutionNote: string | null;
  handledBy: string | null;
}

const REPORT_COLUMNS =
  "id, target_type, target_id, reason, details, status, created_at, handled_at, snapshot, reporter_id, target_author_id, space_id, action, resolution_note, reporter:profiles!reports_reporter_id_fkey(full_name), handler:profiles!reports_handled_by_fkey(full_name)";

type ReportRow = {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  handled_at: string | null;
  snapshot: unknown;
  reporter_id: string | null;
  target_author_id: string | null;
  space_id: string | null;
  action: ModerationActionType | null;
  resolution_note: string | null;
  reporter: { full_name: string } | null;
  handler: { full_name: string } | null;
};

function toReport(r: ReportRow): ReportSummary {
  return {
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    snapshot: (r.snapshot ?? {}) as ReportSummary["snapshot"],
    reporter: { id: r.reporter_id, name: r.reporter?.full_name ?? null },
    authorId: r.target_author_id,
    spaceId: r.space_id,
    action: r.action,
    resolutionNote: r.resolution_note,
    handledBy: r.handler?.full_name ?? null,
  };
}

export async function listReports(filters: {
  status?: ReportStatus;
  reason?: ReportReason;
  target?: ReportTarget;
  limit?: number;
}): Promise<ReportSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .order("created_at", { ascending: filters.status === "open" })
    .limit(filters.limit ?? 100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.reason) query = query.eq("reason", filters.reason);
  if (filters.target) query = query.eq("target_type", filters.target);
  const { data, error } = await query;
  if (error) {
    console.error("listReports", error);
    throw new Error("Couldn't load reports.");
  }
  return (data as ReportRow[]).map(toReport);
}

export async function countReportsByStatus(): Promise<Record<ReportStatus, number>> {
  const supabase = await createClient();
  const statuses: ReportStatus[] = ["open", "resolved", "dismissed"];
  const counts = await Promise.all(
    statuses.map((s) =>
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, counts[i].count ?? 0])) as Record<
    ReportStatus,
    number
  >;
}

export interface ReportDetail extends ReportSummary {
  /** Every report about the same thing, including this one. */
  related: ReportSummary[];
  author: {
    id: string;
    name: string;
    username: string | null;
    role: UserRole | null;
    status: AccountStatus | null;
    reportsAgainst: number;
    recentActions: LogEntry[];
  } | null;
  spaceName: string | null;
}

export async function getReport(id: string): Promise<ReportDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select(REPORT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const report = toReport(data as ReportRow);

  const [{ data: related }, author, space] = await Promise.all([
    supabase
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("target_type", report.targetType)
      .eq("target_id", report.targetId)
      .order("created_at", { ascending: true }),
    report.authorId ? loadAuthor(report.authorId) : Promise.resolve(null),
    report.spaceId
      ? supabase.from("spaces").select("name").eq("id", report.spaceId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...report,
    related: ((related ?? []) as ReportRow[]).map(toReport),
    author,
    spaceName: space.data?.name ?? null,
  };
}

async function loadAuthor(authorId: string): Promise<ReportDetail["author"]> {
  const supabase = await createClient();
  const [{ data: profile }, { count }, log] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, username, role, status")
      .eq("id", authorId)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_author_id", authorId),
    listModerationLog({ targetId: authorId, limit: 5 }),
  ]);
  return {
    id: authorId,
    name: profile?.full_name ?? "Former member",
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
    reportsAgainst: count ?? 0,
    recentActions: log,
  };
}

// Moderation log ---------------------------------------------------------------------------------

export interface LogEntry {
  id: string;
  action: ModerationActionType;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  reportId: string | null;
  createdAt: string;
  actor: { id: string | null; name: string | null };
}

export async function listModerationLog(filters: {
  action?: ModerationActionType;
  actorId?: string;
  targetId?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<LogEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("moderation_actions")
    .select(
      "id, action, target_type, target_id, reason, metadata, report_id, created_at, actor_id, actor:profiles!moderation_actions_actor_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.targetId) query = query.eq("target_id", filters.targetId);
  if (filters.since) query = query.gte("created_at", filters.since);
  if (filters.until) query = query.lt("created_at", filters.until);
  const { data, error } = await query;
  if (error) {
    console.error("listModerationLog", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    reportId: row.report_id,
    createdAt: row.created_at,
    actor: {
      id: row.actor_id,
      name: (row.actor as { full_name: string } | null)?.full_name ?? null,
    },
  }));
}

/** People who have moderated something (for the log's filter). */
export async function listModerators(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["lecturer", "coordinator", "super_admin"])
    .eq("status", "approved")
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
}

// Users ------------------------------------------------------------------------------------------

export interface AdminUserRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  departmentName: string | null;
  yearOfStudy: number | null;
  suspendedUntil: string | null;
  createdAt: string;
}

export const USERS_PAGE_SIZE = 50;

export async function searchUsers(filters: {
  q?: string;
  role?: UserRole;
  status?: AccountStatus;
  departmentId?: string;
  page?: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_users", {
    p_query: filters.q || undefined,
    p_role: filters.role,
    p_status: filters.status,
    p_department: filters.departmentId,
    p_limit: USERS_PAGE_SIZE,
    p_offset: ((filters.page ?? 1) - 1) * USERS_PAGE_SIZE,
  });
  if (error) {
    // Let the page's error state show rather than an empty, misleading list.
    console.error("searchUsers", error);
    throw new Error("Couldn't load accounts.");
  }
  return {
    total: Number(data?.[0]?.total_count ?? 0),
    users: (data ?? []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      username: u.username,
      email: u.email,
      avatarUrl: u.avatar_url,
      role: u.role,
      status: u.status,
      departmentName: u.department_name,
      yearOfStudy: u.year_of_study,
      suspendedUntil: u.suspended_until,
      createdAt: u.created_at,
    })),
  };
}

export async function getUserDetail(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("admin_user_detail", { p_user_id: userId })
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getUserDetail", error);
    return null;
  }
  const [history, { data: reports }] = await Promise.all([
    listModerationLog({ targetId: userId, limit: 50 }),
    supabase
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("target_author_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return {
    user: data,
    history,
    reports: ((reports ?? []) as ReportRow[]).map(toReport),
  };
}
export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

// Spaces, departments, tags --------------------------------------------------------------------------

export async function listAllSpaces() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select(
      "id, slug, name, type, description, join_policy, is_archived, member_count, department_id, year_of_study, module_code, icon, departments(name)",
    )
    .order("is_archived")
    .order("name");
  return data ?? [];
}

export async function listAllDepartments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("id, name, code, is_active, created_at")
    .order("name");
  const ids = (data ?? []).map((d) => d.id);
  const { data: members } = ids.length
    ? await supabase.from("profiles").select("department_id").in("department_id", ids)
    : { data: [] };
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.department_id) counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1);
  }
  return (data ?? []).map((d) => ({ ...d, members: counts.get(d.id) ?? 0 }));
}

export async function listAllTags() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("id, name, slug, description, usage_count, created_at")
    .order("usage_count", { ascending: false })
    .order("name");
  return data ?? [];
}

/** Open reports (the sidebar badge for coordinators and super admins). */
export async function openReportCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}

/** Account deletion requests waiting for an admin (RLS: admins see all). */
export async function listPendingDeletionRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_deletion_requests")
    .select(
      "id, user_id, reason, created_at, profiles!account_deletion_requests_user_id_fkey(full_name)",
    )
    .eq("status", "pending")
    .order("created_at");
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    reason: r.reason,
    createdAt: r.created_at,
    name: (r.profiles as { full_name: string } | null)?.full_name ?? "Member",
  }));
}
