import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Departments, batches, their lecturers and class reps. */

export interface PersonRef {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface BatchSummary {
  id: string;
  name: string;
  number: number;
  departmentId: string;
  departmentName: string;
  spaceSlug: string | null;
  rep: PersonRef | null;
  lecturers: PersonRef[];
  students: PersonRef[];
}

function person(p: { id: string; full_name: string; username: string; avatar_url: string | null }) {
  return { id: p.id, name: p.full_name, username: p.username, avatarUrl: p.avatar_url };
}

/** Batches of one department, newest intake first (for pickers). */
export async function listDepartmentBatches(
  departmentId: string,
): Promise<{ id: string; name: string; number: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, number")
    .eq("department_id", departmentId)
    .order("number", { ascending: false });
  return data ?? [];
}

/** Everything the Batches admin page shows for the given departments. */
export async function listBatchOverview(departmentIds: string[]): Promise<BatchSummary[]> {
  if (departmentIds.length === 0) return [];
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("batches")
    .select(
      "id, name, number, department_id, rep_id, departments(name), spaces!batches_space_id_fkey(slug)",
    )
    .in("department_id", departmentIds)
    .order("number", { ascending: false });
  if (!batches || batches.length === 0) return [];
  const ids = batches.map((b) => b.id);

  const [{ data: lecturerRows }, { data: students }] = await Promise.all([
    supabase
      .from("batch_lecturers")
      .select(
        "batch_id, profiles!batch_lecturers_lecturer_id_fkey(id, full_name, username, avatar_url)",
      )
      .in("batch_id", ids),
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, batch_id")
      .in("batch_id", ids)
      .eq("status", "approved")
      .order("full_name"),
  ]);

  return batches.map((b) => {
    const batchStudents = (students ?? []).filter((s) => s.batch_id === b.id).map(person);
    return {
      id: b.id,
      name: b.name,
      number: b.number,
      departmentId: b.department_id,
      departmentName: b.departments?.name ?? "",
      spaceSlug: b.spaces?.slug ?? null,
      rep: batchStudents.find((s) => s.id === b.rep_id) ?? null,
      lecturers: (lecturerRows ?? [])
        .filter((l) => l.batch_id === b.id && l.profiles)
        .map((l) => person(l.profiles!)),
      students: batchStudents,
    };
  });
}

/** Approved lecturers (and coordinators, who may also teach) in these departments. */
export async function listDepartmentLecturers(
  departmentIds: string[],
): Promise<(PersonRef & { departmentId: string | null })[]> {
  if (departmentIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, department_id")
    .in("role", ["lecturer", "coordinator"])
    .eq("status", "approved")
    .in("department_id", departmentIds)
    .order("full_name");
  return (data ?? []).map((p) => ({ ...person(p), departmentId: p.department_id }));
}

/** The batch behind a batch space, for its header: rep and lecturers. */
export async function getBatchForSpace(spaceId: string): Promise<{
  id: string;
  name: string;
  rep: PersonRef | null;
  lecturers: PersonRef[];
} | null> {
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select(
      "id, name, rep:profiles!batches_rep_id_fkey(id, full_name, username, avatar_url), batch_lecturers(profiles!batch_lecturers_lecturer_id_fkey(id, full_name, username, avatar_url))",
    )
    .eq("space_id", spaceId)
    .maybeSingle();
  if (!batch) return null;
  return {
    id: batch.id,
    name: batch.name,
    rep: batch.rep ? person(batch.rep) : null,
    lecturers: (batch.batch_lecturers ?? [])
      .filter((l) => l.profiles)
      .map((l) => person(l.profiles!)),
  };
}

/** Ids of everyone who is currently a class rep (to highlight them in feeds). */
export async function listClassRepIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("batches").select("rep_id").not("rep_id", "is", null);
  return new Set((data ?? []).map((b) => b.rep_id!).filter(Boolean));
}
