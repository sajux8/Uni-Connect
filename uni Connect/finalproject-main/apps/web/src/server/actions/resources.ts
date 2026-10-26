"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { databaseErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireApproved, requireRole } from "@/lib/auth/session";
import { matchesSignature, MAX_RESOURCE_BYTES } from "@/lib/resources";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resourceSchema, reviewNoteSchema, type ResourceInput } from "@/lib/validation/resources";
import { ensureMembership } from "@/server/queries/membership";

const id = z.uuid();

/**
 * Checks the file that was uploaded straight from the browser: it must be in the user's own
 * folder, really exist, be within the size limit, and start with the right bytes for its type.
 */
async function verifyUpload(
  userId: string,
  path: string,
  mimeType: string,
): Promise<{ size: number } | { error: string }> {
  if (path.split("/")[0] !== userId || path.includes(".."))
    return { error: "That upload isn't yours." };
  const storage = createAdminClient().storage.from("resources");
  const { data: info, error } = await storage.info(path);
  if (error || !info) return { error: "The upload didn't finish. Please try again." };
  const size = Number(info.size ?? 0);
  if (size < 1 || size > MAX_RESOURCE_BYTES) return { error: "Files can be up to 25 MB." };

  const { data: signed } = await storage.createSignedUrl(path, 30);
  if (!signed) return { error: "Couldn't check the file. Please try again." };
  const head = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" } })
    .then((r) => r.arrayBuffer())
    .then((b) => new Uint8Array(b))
    .catch(() => null);
  if (!head || !matchesSignature(mimeType, head)) {
    await storage.remove([path]);
    return { error: "That file doesn't look like the type it claims to be." };
  }
  return { size };
}

export async function createResource(
  input: ResourceInput,
): Promise<ActionResult<{ id: string; pending: boolean }>> {
  const user = await requireApproved();
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>,
    );
  }
  const d = parsed.data;
  const supabase = await createClient();

  let fileSize: number | null = null;
  if (d.kind === "file") {
    const checked = await verifyUpload(user.id, d.filePath, d.mimeType);
    if ("error" in checked) return fail(checked.error, { file: [checked.error] });
    fileSize = checked.size;
  }
  if (d.spaceId) {
    const membershipError = await ensureMembership(supabase, d.spaceId, user.id);
    if (membershipError) return fail(membershipError, { spaceId: [membershipError] });
  }

  const { data, error } = await supabase
    .from("resources")
    .insert({
      uploader_id: user.id,
      title: d.title,
      description: d.description || null,
      kind: d.kind,
      file_path: d.kind === "file" ? d.filePath : null,
      file_name: d.kind === "file" ? d.fileName : null,
      file_size: fileSize,
      mime_type: d.kind === "file" ? d.mimeType : null,
      url: d.kind === "link" ? d.url : null,
      department_id: d.departmentId || null,
      module_code: d.moduleCode ? d.moduleCode.toUpperCase() : null,
      space_id: d.spaceId || null,
    })
    .select("id, status")
    .single();
  if (error || !data) {
    console.error("createResource", error);
    return fail(databaseErrorMessage(error));
  }
  if (d.tagIds.length > 0) {
    await supabase
      .from("resource_tags")
      .insert(d.tagIds.map((tagId) => ({ resource_id: data.id, tag_id: tagId })));
  }

  revalidatePath("/resources", "layout");
  revalidatePath("/admin/resources");
  const pending = data.status === "pending";
  return ok(
    { id: data.id, pending },
    pending ? "Thanks! A moderator will review it shortly." : "Resource published.",
  );
}

export async function deleteResource(resourceId: string): Promise<ActionResult> {
  await requireApproved();
  if (!id.safeParse(resourceId).success) return fail("That resource doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId)
    .select("file_path");
  if (error) return fail(databaseErrorMessage(error));
  if (!data || data.length === 0) return fail("You can only delete your own resources.");
  // The row is gone (RLS allowed it), so remove the file too.
  const path = data[0].file_path;
  if (path) await createAdminClient().storage.from("resources").remove([path]);
  revalidatePath("/resources", "layout");
  revalidatePath("/admin/resources");
  return ok(undefined, "Resource deleted.");
}

export async function reviewResource(
  resourceId: string,
  approve: boolean,
  note?: string,
): Promise<ActionResult> {
  await requireRole("coordinator");
  if (!id.safeParse(resourceId).success) return fail("That resource doesn't exist.");
  const parsedNote = reviewNoteSchema.safeParse(note ?? "");
  if (!parsedNote.success)
    return fail(parsedNote.error.issues[0]?.message ?? "That note isn't valid.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_resource", {
    p_resource_id: resourceId,
    p_approve: approve,
    p_note: parsedNote.data || undefined,
  });
  if (error) {
    console.error("reviewResource", error);
    return fail(databaseErrorMessage(error));
  }
  revalidatePath("/resources", "layout");
  revalidatePath("/admin/resources");
  return ok(
    undefined,
    approve ? "Approved and published." : "Rejected. The uploader has been told why.",
  );
}
