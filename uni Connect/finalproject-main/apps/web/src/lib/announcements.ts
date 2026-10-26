import type { CategoryTint } from "@/components/shared/badges";
import { yearLabel } from "@/lib/campus";
import type { Enums } from "@/types/database";

export type AnnouncementCategory = Enums<"announcement_category">;
export type PublishStatus = Enums<"publish_status">;

export const ANNOUNCEMENT_CATEGORIES: {
  value: AnnouncementCategory;
  label: string;
  tint: CategoryTint;
}[] = [
  { value: "academic", label: "Academic", tint: "blue" },
  { value: "deadline", label: "Deadline", tint: "amber" },
  { value: "event", label: "Event", tint: "violet" },
  { value: "general", label: "General", tint: "zinc" },
  { value: "urgent", label: "Urgent", tint: "red" },
];

export function categoryInfo(category: AnnouncementCategory) {
  return ANNOUNCEMENT_CATEGORIES.find((c) => c.value === category) ?? ANNOUNCEMENT_CATEGORIES[3];
}

export function parseCategory(value: unknown): AnnouncementCategory | undefined {
  return ANNOUNCEMENT_CATEGORIES.find((c) => c.value === value)?.value;
}

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/** Publishing units offered as suggestions (publishers can type their own). */
export const PUBLISHING_UNIT_SUGGESTIONS = [
  "Registry",
  "Academic Affairs",
  "Examinations Office",
  "Student Services",
  "Careers Office",
  "IT Services",
  "Library",
  "Student Union",
];

/**
 * "Everyone", or e.g. "Computing, Law · Year 1, Year 2".
 * Departments and years combine with AND (see audience_includes in migration 0010).
 */
export function audienceLabel(
  audience: { all: boolean; departmentIds: string[]; years: number[] },
  departments: { id: string; name: string }[],
): string {
  if (audience.all) return "Everyone";
  const names = audience.departmentIds
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter(Boolean);
  const years = [...audience.years].sort((a, b) => a - b).map((y) => yearLabel(y));
  const parts = [
    names.length > 0 ? names.join(", ") : "All departments",
    years.length > 0 ? years.join(", ") : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
