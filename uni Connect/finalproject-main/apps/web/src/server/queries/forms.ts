import "server-only";

import type { SessionProfile } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import type { AnswerRow, FormStatus, QuestionType } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Feedback forms. Read as the signed-in user: RLS shows students only
 * the published forms meant for them, and answers only to the people allowed to see results.
 */

export interface FormSummary {
  id: string;
  title: string;
  description: string;
  status: FormStatus;
  closesAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  aboutLecturer: { id: string; name: string } | null;
  departmentId: string;
  departmentName: string;
  batchIds: string[];
}

export interface FormQuestionRow {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  help: string;
  required: boolean;
  options: string[];
  scaleMax: number | null;
  minLabel: string | null;
  maxLabel: string | null;
}

export interface FormDetail extends FormSummary {
  questions: FormQuestionRow[];
  batchNames: string[];
}

const FORM_COLUMNS =
  "id, title, description, status, closes_at, published_at, created_at, department_id, batch_ids, creator:profiles!forms_created_by_fkey(id, full_name), about:profiles!forms_about_lecturer_id_fkey(id, full_name), departments(name)";

type FormRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  closes_at: string | null;
  published_at: string | null;
  created_at: string;
  department_id: string;
  batch_ids: string[];
  creator: { id: string; full_name: string } | null;
  about: { id: string; full_name: string } | null;
  departments: { name: string } | null;
};

function toSummary(r: FormRow): FormSummary {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as FormStatus,
    closesAt: r.closes_at,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    createdBy: r.creator ? { id: r.creator.id, name: r.creator.full_name } : null,
    aboutLecturer: r.about ? { id: r.about.id, name: r.about.full_name } : null,
    departmentId: r.department_id,
    departmentName: r.departments?.name ?? "",
    batchIds: r.batch_ids,
  };
}

/** Published forms for the signed-in student, split into still to answer and answered. */
export async function listStudentForms(
  userId: string,
): Promise<{ toAnswer: FormSummary[]; answered: FormSummary[]; closed: FormSummary[] }> {
  const supabase = await createClient();
  const [{ data: forms }, { data: done }] = await Promise.all([
    supabase
      .from("forms")
      .select(FORM_COLUMNS)
      .neq("status", "draft")
      .order("published_at", { ascending: false })
      .limit(100),
    supabase.from("form_submissions").select("form_id").eq("user_id", userId),
  ]);
  const answeredIds = new Set((done ?? []).map((d) => d.form_id));
  const all = ((forms ?? []) as FormRow[]).map(toSummary);
  const now = Date.now();
  const isOpen = (f: FormSummary) =>
    f.status === "open" && (!f.closesAt || new Date(f.closesAt).getTime() > now);
  return {
    toAnswer: all.filter((f) => isOpen(f) && !answeredIds.has(f.id)),
    answered: all.filter((f) => answeredIds.has(f.id)),
    closed: all.filter((f) => !isOpen(f) && !answeredIds.has(f.id)),
  };
}

export type StaffFormsTab = "mine" | "about" | "department";

/** Staff views: forms I made, forms about me, or (coordinators) every form in my department. */
export async function listStaffForms(
  user: SessionProfile,
  tab: StaffFormsTab,
): Promise<FormSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("forms")
    .select(FORM_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab === "mine") query = query.eq("created_by", user.id);
  else if (tab === "about") query = query.eq("about_lecturer_id", user.id).neq("status", "draft");
  else if (user.role !== "super_admin") query = query.eq("department_id", user.departmentId ?? "");
  const { data, error } = await query;
  if (error) console.error("listStaffForms", error);
  return ((data ?? []) as FormRow[]).map(toSummary);
}

/** Open forms the student hasn't answered yet (for Home). */
export async function formsToAnswer(user: SessionProfile): Promise<FormSummary[]> {
  if (user.role !== "student") return [];
  return (await listStudentForms(user.id)).toAnswer;
}

export async function getForm(id: string): Promise<FormDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("forms").select(FORM_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const form = toSummary(data as FormRow);
  const [{ data: questions }, { data: batches }] = await Promise.all([
    supabase
      .from("form_questions")
      .select(
        "id, position, type, prompt, help_text, required, options, scale_max, scale_min_label, scale_max_label",
      )
      .eq("form_id", id)
      .order("position"),
    form.batchIds.length
      ? supabase
          .from("batches")
          .select("name")
          .in("id", form.batchIds)
          .order("number", { ascending: false })
      : Promise.resolve({ data: [] as { name: string }[] }),
  ]);
  return {
    ...form,
    batchNames: (batches ?? []).map((b) => b.name),
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      position: q.position,
      type: q.type as QuestionType,
      prompt: q.prompt,
      help: q.help_text,
      required: q.required,
      options: q.options,
      scaleMax: q.scale_max,
      minLabel: q.scale_min_label,
      maxLabel: q.scale_max_label,
    })),
  };
}

export async function hasAnswered(formId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("form_id")
    .eq("form_id", formId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function canManageForm(formId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_form", { p_form_id: formId });
  return data === true;
}

export async function canSeeResults(formId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_see_form_results", { p_form_id: formId });
  return data === true;
}

export interface ResponseCount {
  batchId: string | null;
  batchName: string;
  students: number;
  responded: number;
}

/** Answers (anonymous) and response counts per batch, for results viewers. */
export async function getResults(
  formId: string,
): Promise<{ answers: AnswerRow[]; counts: ResponseCount[] }> {
  const supabase = await createClient();
  const [{ data: answers, error }, { data: counts }] = await Promise.all([
    supabase
      .from("form_answers")
      .select("question_id, response_id, value_text, value_options, value_number")
      .eq("form_id", formId)
      .limit(20000),
    supabase.rpc("form_response_counts", { p_form_id: formId }),
  ]);
  if (error) console.error("getResults", error);
  return {
    answers: (answers ?? []).map((a) => ({
      questionId: a.question_id,
      responseId: a.response_id,
      text: a.value_text,
      options: a.value_options,
      number: a.value_number,
    })),
    counts: (counts ?? []).map((c) => ({
      batchId: c.batch_id,
      batchName: c.batch_name,
      students: c.students,
      responded: c.responded,
    })),
  };
}

export interface AudienceDepartment {
  id: string;
  name: string;
  /** False when the member can only ask some batches (lecturers). */
  wholeDepartment: boolean;
  batches: { id: string; name: string; lecturers: { id: string; name: string }[] }[];
  /** Lecturers in the department (for "about a lecturer" on whole-department forms). */
  lecturers: { id: string; name: string }[];
}

/**
 * Who this member may ask: super admins any department, coordinators theirs, lecturers only the
 * batches they teach. Lecturers per batch feed "Is this about a lecturer?".
 */
export async function listFormAudiences(user: SessionProfile): Promise<AudienceDepartment[]> {
  const supabase = await createClient();
  const manager = roleAtLeast(user.role, "coordinator");
  let deptQuery = supabase
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (user.role !== "super_admin") deptQuery = deptQuery.eq("id", user.departmentId ?? "");
  let batchQuery = supabase
    .from("batches")
    .select("id, name, number, department_id")
    .eq("is_active", true)
    .order("number", { ascending: false });
  if (!manager) {
    const { data: taught } = await supabase
      .from("batch_lecturers")
      .select("batch_id")
      .eq("lecturer_id", user.id);
    batchQuery = batchQuery.in(
      "id",
      (taught ?? []).map((t) => t.batch_id),
    );
  }
  const [{ data: departments }, { data: batches }] = await Promise.all([deptQuery, batchQuery]);
  const batchIds = (batches ?? []).map((b) => b.id);
  const deptIds = (departments ?? []).map((d) => d.id);
  const [{ data: links }, { data: staff }] = await Promise.all([
    batchIds.length
      ? supabase
          .from("batch_lecturers")
          .select("batch_id, lecturer:profiles!batch_lecturers_lecturer_id_fkey(id, full_name)")
          .in("batch_id", batchIds)
      : Promise.resolve({ data: [] }),
    manager && deptIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, department_id")
          .in("department_id", deptIds)
          .eq("status", "approved")
          .in("role", ["lecturer", "coordinator"])
          .order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  return (departments ?? [])
    .map((d) => ({
      id: d.id,
      name: d.name,
      wholeDepartment: manager,
      batches: (batches ?? [])
        .filter((b) => b.department_id === d.id)
        .map((b) => ({
          id: b.id,
          name: b.name,
          lecturers: (links ?? [])
            .filter((l) => l.batch_id === b.id && l.lecturer)
            .map((l) => ({ id: l.lecturer!.id, name: l.lecturer!.full_name })),
        })),
      lecturers: (staff ?? [])
        .filter((s) => s.department_id === d.id)
        .map((s) => ({ id: s.id, name: s.full_name })),
    }))
    .filter((d) => d.wholeDepartment || d.batches.length > 0);
}
