"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  departmentSchema,
  slugify,
  spaceDetailsSchema,
  spaceSchema,
  tagSchema,
  type DepartmentInput,
  type SpaceDetailsInput,
  type SpaceInput,
  type TagInput,
} from "@/lib/validation/moderation";

/**
 * Admin catalogue: spaces, departments and tags (/admin/spaces,
 * /admin/departments, /admin/tags). RLS limits every write here to admins, except
 * update_space_details, which space moderators may also call.
 */

const id = z.uuid();

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function rpcError(error: { code?: string; message?: string }): string {
  if (["22023", "42501", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return databaseErrorMessage(error);
}

function unique(error: { code?: string; message?: string } | null, field: string, message: string) {
  return error?.code === "23505" && (error.message ?? "").includes(field)
    ? fail(message, { [field]: [message] })
    : null;
}

// Spaces ---------------------------------------------------------------------------------------

function spaceColumns(input: SpaceInput) {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: fail("Please fix the highlighted fields.", fieldErrors(parsed.error)) };
  }
  const d = parsed.data;
  return {
    columns: {
      name: d.name,
      slug: d.slug,
      description: d.description || null,
      type: d.type,
      department_id: id.safeParse(d.departmentId).success ? d.departmentId : null,
      year_of_study: /^[0-5]$/.test(d.yearOfStudy) ? Number(d.yearOfStudy) : null,
      module_code: d.moduleCode || null,
      icon: d.icon || null,
      join_policy: d.joinPolicy,
      rules: d.rules || null,
    },
  };
}

export async function createSpace(input: SpaceInput): Promise<ActionResult<{ slug: string }>> {
  const user = await requireRole("super_admin");
  const prepared = spaceColumns(input);
  if (prepared.error) return prepared.error;
  const supabase = await createClient();
  const { error } = await supabase
    .from("spaces")
    .insert({ ...prepared.columns, created_by: user.id });
  if (error) {
    return unique(error, "slug", "That web address is taken.") ?? fail(databaseErrorMessage(error));
  }
  revalidatePath("/spaces", "layout");
  revalidatePath("/admin/spaces");
  return ok({ slug: prepared.columns.slug }, "Space created.");
}

export async function updateSpace(
  spaceId: string,
  input: SpaceInput,
): Promise<ActionResult<{ slug: string }>> {
  await requireRole("super_admin");
  if (!id.safeParse(spaceId).success) return fail("That space isn't valid.");
  const prepared = spaceColumns(input);
  if (prepared.error) return prepared.error;
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").update(prepared.columns).eq("id", spaceId);
  if (error) {
    return unique(error, "slug", "That web address is taken.") ?? fail(databaseErrorMessage(error));
  }
  revalidatePath("/spaces", "layout");
  revalidatePath("/admin/spaces");
  return ok({ slug: prepared.columns.slug }, "Space saved.");
}

/** Space moderators: description, rules and join policy. */
export async function updateSpaceDetails(
  spaceId: string,
  input: SpaceDetailsInput,
): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(spaceId).success) return fail("That space isn't valid.");
  const parsed = spaceDetailsSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_details", {
    p_space_id: spaceId,
    p_description: parsed.data.description,
    p_rules: parsed.data.rules,
    p_join_policy: parsed.data.joinPolicy,
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/spaces", "layout");
  return ok(undefined, "Space settings saved.");
}

export async function setSpaceArchived(spaceId: string, archived: boolean): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!id.safeParse(spaceId).success) return fail("That space isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("spaces")
    .update({ is_archived: archived })
    .eq("id", spaceId);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/spaces", "layout");
  revalidatePath("/admin/spaces");
  return ok(undefined, archived ? "Space archived." : "Space restored.");
}

export async function setSpaceModerator(
  spaceId: string,
  userId: string,
  moderator: boolean,
): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!id.safeParse(spaceId).success || !id.safeParse(userId).success) {
    return fail("That request isn't valid.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_space_moderator", {
    p_space_id: spaceId,
    p_user_id: userId,
    p_moderator: moderator,
  });
  if (error) return fail(rpcError(error));
  revalidatePath("/spaces", "layout");
  return ok(undefined, moderator ? "Moderator added." : "Moderator removed.");
}

/** People an admin can make a space moderator (by name or username). */
export async function findMembers(
  query: string,
): Promise<ActionResult<{ id: string; name: string; username: string }[]>> {
  await requireRole("super_admin");
  const q = query.trim().replace(/[%_,()]/g, "");
  if (q.length < 2) return ok([]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_cards")
    .select("id, full_name, username")
    .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(8);
  return ok(
    (data ?? []).map((p) => ({ id: p.id!, name: p.full_name ?? "", username: p.username ?? "" })),
  );
}

// Departments -------------------------------------------------------------------------------------

export async function saveDepartment(
  departmentId: string | null,
  input: DepartmentInput,
): Promise<ActionResult> {
  await requireRole("super_admin");
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = departmentId
    ? await supabase.from("departments").update(parsed.data).eq("id", departmentId)
    : await supabase.from("departments").insert(parsed.data);
  if (error) {
    return (
      unique(error, "code", "Another department uses that code.") ??
      unique(error, "name", "Another department has that name.") ??
      fail(databaseErrorMessage(error))
    );
  }
  revalidatePath("/admin/departments");
  return ok(undefined, departmentId ? "Department saved." : "Department added.");
}

/** Hidden departments disappear from sign-up and filters; existing members keep them. */
export async function setDepartmentActive(
  departmentId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!id.safeParse(departmentId).success) return fail("That department isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ is_active: active })
    .eq("id", departmentId);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/admin/departments");
  return ok(undefined, active ? "Department shown again." : "Department hidden.");
}

// Tags ----------------------------------------------------------------------------------------------

export async function saveTag(tagId: string | null, input: TagInput): Promise<ActionResult> {
  await requireRole("super_admin");
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const columns = {
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description || null,
  };
  if (!columns.slug)
    return fail("Use some letters or numbers.", { name: ["Use some letters or numbers."] });
  const supabase = await createClient();
  const { error } = tagId
    ? await supabase.from("tags").update(columns).eq("id", tagId)
    : await supabase.from("tags").insert(columns);
  if (error) {
    return error.code === "23505"
      ? fail("A tag with that name already exists. Merge them instead.", {
          name: ["A tag with that name already exists."],
        })
      : fail(databaseErrorMessage(error));
  }
  revalidatePath("/admin/tags");
  return ok(undefined, tagId ? "Tag saved." : "Tag added.");
}

export async function deleteTag(tagId: string): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!id.safeParse(tagId).success) return fail("That tag isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) return fail(databaseErrorMessage(error));
  revalidatePath("/admin/tags");
  return ok(undefined, "Tag deleted.");
}

export async function mergeTags(fromId: string, intoId: string): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!id.safeParse(fromId).success || !id.safeParse(intoId).success) {
    return fail("Choose two tags.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_tags", { p_from: fromId, p_into: intoId });
  if (error) return fail(rpcError(error));
  revalidatePath("/admin/tags");
  return ok(undefined, "Tags merged.");
}
