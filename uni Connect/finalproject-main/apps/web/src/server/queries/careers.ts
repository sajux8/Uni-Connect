import "server-only";

import type { SessionProfile } from "@/lib/auth/session";
import type { DeadlineFilter, OpportunityType, WorkMode } from "@/lib/careers";
import { DEADLINE_FILTERS } from "@/lib/careers";
import { createClient } from "@/lib/supabase/server";

/** Careers. RLS shows each member the opportunities meant for them. */

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  type: OpportunityType;
  mode: WorkMode;
  location: string | null;
  description: string;
  applyUrl: string | null;
  applyEmail: string | null;
  deadline: string | null;
  status: "open" | "closed";
  departmentId: string | null;
  departmentName: string | null;
  batchIds: string[];
  postedBy: { id: string; name: string } | null;
  createdAt: string;
}

const COLUMNS =
  "id, title, company, type, mode, location, description, apply_url, apply_email, deadline, status, department_id, batch_ids, created_at, departments(name), poster:profiles!opportunities_posted_by_fkey(id, full_name)";

type Row = {
  id: string;
  title: string;
  company: string;
  type: string;
  mode: string;
  location: string | null;
  description: string;
  apply_url: string | null;
  apply_email: string | null;
  deadline: string | null;
  status: string;
  department_id: string | null;
  batch_ids: string[];
  created_at: string;
  departments: { name: string } | null;
  poster: { id: string; full_name: string } | null;
};

function toOpportunity(r: Row): Opportunity {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    type: r.type as OpportunityType,
    mode: r.mode as WorkMode,
    location: r.location,
    description: r.description,
    applyUrl: r.apply_url,
    applyEmail: r.apply_email,
    deadline: r.deadline,
    status: r.status as Opportunity["status"],
    departmentId: r.department_id,
    departmentName: r.departments?.name ?? null,
    batchIds: r.batch_ids,
    postedBy: r.poster ? { id: r.poster.id, name: r.poster.full_name } : null,
    createdAt: r.created_at,
  };
}

/**
 * Open opportunities (soonest deadline first) or closed ones (closed by hand or past their
 * deadline, newest first), with optional type, mode and deadline filters.
 */
export async function listOpportunities(options: {
  closed: boolean;
  type?: OpportunityType;
  mode?: WorkMode;
  closes?: DeadlineFilter;
}): Promise<Opportunity[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase.from("opportunities").select(COLUMNS).limit(100);
  if (options.closed) {
    query = query
      .or(`status.eq.closed,deadline.lte.${now}`)
      .order("created_at", { ascending: false });
  } else {
    query = query
      .eq("status", "open")
      .or(`deadline.is.null,deadline.gt.${now}`)
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }
  if (options.type) query = query.eq("type", options.type);
  if (options.mode) query = query.eq("mode", options.mode);
  if (options.closes && !options.closed) {
    const days = DEADLINE_FILTERS.find((d) => d.value === options.closes)!.days;
    query = query.lte("deadline", new Date(Date.now() + days * 86_400_000).toISOString());
  }
  const { data, error } = await query;
  if (error) console.error("listOpportunities", error);
  return ((data ?? []) as Row[]).map(toOpportunity);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toOpportunity(data as Row) : null;
}

/** Can the signed-in member post to (or manage posts in) this department? null = campus-wide. */
export async function canPostOpportunity(departmentId: string | null): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_post_opportunity", {
    // null means campus-wide; the generated type doesn't know the parameter accepts it.
    p_department_id: departmentId as string,
  });
  return data === true;
}

export interface PostingAudience {
  id: string;
  name: string;
  batches: { id: string; name: string }[];
}

/** Where this member may post: their department (coordinators) or any (super admins, plus campus-wide). */
export async function listPostingAudiences(user: SessionProfile): Promise<PostingAudience[]> {
  const supabase = await createClient();
  let deptQuery = supabase
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (user.role !== "super_admin") deptQuery = deptQuery.eq("id", user.departmentId ?? "");
  const { data: departments } = await deptQuery;
  const ids = (departments ?? []).map((d) => d.id);
  const { data: batches } = ids.length
    ? await supabase
        .from("batches")
        .select("id, name, number, department_id")
        .in("department_id", ids)
        .eq("is_active", true)
        .order("number", { ascending: false })
    : { data: [] };
  return (departments ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    batches: (batches ?? [])
      .filter((b) => b.department_id === d.id)
      .map((b) => ({ id: b.id, name: b.name })),
  }));
}

/** Which opportunities the member has bookmarked. */
export async function savedOpportunityIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("target_id")
    .eq("user_id", userId)
    .eq("target_type", "opportunity");
  return new Set((data ?? []).map((b) => b.target_id));
}
