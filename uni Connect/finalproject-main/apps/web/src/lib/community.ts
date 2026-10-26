import type { CategoryTint } from "@/components/shared/badges";
import type { Enums } from "@/types/database";

export type SpaceType = Enums<"space_type">;
export type PostType = Enums<"post_type">;
export type NotifyLevel = Enums<"notify_level">;

export const SPACE_TYPES: {
  value: SpaceType;
  label: string;
  plural: string;
  tint: CategoryTint;
}[] = [
  { value: "department", label: "Department", plural: "Departments", tint: "indigo" },
  { value: "batch", label: "Batch", plural: "Batches", tint: "teal" },
  { value: "module", label: "Module", plural: "Modules", tint: "blue" },
  { value: "club", label: "Club", plural: "Clubs", tint: "pink" },
  { value: "general", label: "General", plural: "General", tint: "zinc" },
];

export function spaceTypeInfo(type: SpaceType) {
  return SPACE_TYPES.find((t) => t.value === type) ?? SPACE_TYPES[SPACE_TYPES.length - 1];
}

export const NOTIFY_LEVELS: { value: NotifyLevel; label: string; description: string }[] = [
  { value: "all", label: "All posts", description: "Hear about every new post." },
  { value: "important", label: "Important only", description: "Replies in threads you follow." },
  { value: "muted", label: "Muted", description: "Only direct replies to you." },
];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  discussion: "Discussion",
  question: "Question",
};
