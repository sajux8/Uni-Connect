import "server-only";

import type { UserRole } from "@/lib/campus";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type ReviewStatus = Enums<"review_status">;

export interface ResourceSummary {
  id: string;
  title: string;
  description: string | null;
  kind: Enums<"resource_kind">;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  url: string | null;
  moduleCode: string | null;
  departmentName: string | null;
  spaceName: string | null;
  status: ReviewStatus;
  downloadCount: number;
  createdAt: string;
  uploader: { id: string | null; name: string | null; role: UserRole | null };
}

const COLUMNS =
  "id, title, description, kind, file_name, file_size, mime_type, url, module_code, status, download_count, created_at, uploader_id, departments(name), spaces(name), profiles!resources_uploader_id_fkey(full_name, role)";

type Row = {
  id: string;
  title: string;
  description: string | null;
  kind: Enums<"resource_kind">;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  url: string | null;
  module_code: string | null;
  status: ReviewStatus;
  download_count: number;
  created_at: string;
  uploader_id: string | null;
  departments: { name: string } | null;
  spaces: { name: string } | null;
  profiles: { full_name: string; role: UserRole } | null;
};

function toSummary(r: Row): ResourceSummary {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    fileName: r.file_name,
    fileSize: r.file_size,
    mimeType: r.mime_type,
    url: r.url,
    moduleCode: r.module_code,
    departmentName: r.departments?.name ?? null,
    spaceName: r.spaces?.name ?? null,
    status: r.status,
    downloadCount: r.download_count,
    createdAt: r.created_at,
    uploader: {
      id: r.uploader_id,
      name: r.profiles?.full_name ?? null,
      role: r.profiles?.role ?? null,
    },
  };
}

export const RESOURCES_PAGE_SIZE = 24;

export async function listResources(options: {
  q?: string;
  departmentId?: string;
  spaceId?: string;
  kind?: "file" | "link";
  mineOf?: string;
  status?: ReviewStatus;
  limit?: number;
}): Promise<ResourceSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("resources")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? RESOURCES_PAGE_SIZE);
  if (options.mineOf) query = query.eq("uploader_id", options.mineOf);
  else query = query.eq("status", options.status ?? "approved");
  if (options.status && options.mineOf) query = query.eq("status", options.status);
  if (options.departmentId) query = query.eq("department_id", options.departmentId);
  if (options.spaceId) query = query.eq("space_id", options.spaceId);
  if (options.kind) query = query.eq("kind", options.kind);
  if (options.q)
    query = query.textSearch("tsv", options.q, { type: "websearch", config: "english" });

  const { data, error } = await query;
  if (error) {
    console.error("listResources", error);
    throw new Error("Couldn't load resources.");
  }
  return (data as unknown as Row[]).map(toSummary);
}

export interface ResourceDetail extends ResourceSummary {
  filePath: string | null;
  departmentId: string | null;
  spaceId: string | null;
  spaceSlug: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  tags: { id: string; name: string; slug: string }[];
}

export async function getResource(id: string): Promise<ResourceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select(
      `${COLUMNS}, file_path, department_id, space_id, review_note, reviewed_at, resource_tags(tags(id, name, slug))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row & {
    file_path: string | null;
    department_id: string | null;
    space_id: string | null;
    review_note: string | null;
    reviewed_at: string | null;
    resource_tags: { tags: { id: string; name: string; slug: string } | null }[];
  };
  let spaceSlug: string | null = null;
  if (row.space_id) {
    const { data: space } = await supabase
      .from("spaces")
      .select("slug")
      .eq("id", row.space_id)
      .maybeSingle();
    spaceSlug = space?.slug ?? null;
  }
  return {
    ...toSummary(row),
    filePath: row.file_path,
    departmentId: row.department_id,
    spaceId: row.space_id,
    spaceSlug,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    tags: row.resource_tags.flatMap((t) => (t.tags ? [t.tags] : [])),
  };
}

/** Moderator queue (RLS shows moderators every pending resource). */
export async function listPendingResources(): Promise<ResourceSummary[]> {
  return listResources({ status: "pending", limit: 100 });
}
