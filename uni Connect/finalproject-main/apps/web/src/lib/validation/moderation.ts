import * as z from "zod";

export const REPORT_TARGETS = [
  "post",
  "reply",
  "resource",
  "message",
  "event",
  "announcement",
  "user",
  "space",
] as const;
export const REPORT_REASON_VALUES = [
  "spam",
  "harassment",
  "hate",
  "misinformation",
  "impersonation",
  "inappropriate",
  "privacy",
  "other",
] as const;

export const reportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGETS),
    targetId: z.uuid(),
    reason: z.enum(REPORT_REASON_VALUES, { error: "Choose a reason." }),
    details: z.string().trim().max(1000, { error: "Use 1000 characters or fewer." }),
  })
  .refine((r) => r.reason !== "other" || r.details.length >= 5, {
    error: "Tell the moderators what's wrong.",
    path: ["details"],
  });
export type ReportInput = z.input<typeof reportSchema>;

export const decisionSchema = z.object({
  reportId: z.uuid(),
  action: z.enum(["dismiss", "hide", "remove", "warn", "suspend", "ban_from_space"]),
  note: z
    .string()
    .trim()
    .min(3, { error: "Add a short note explaining your decision." })
    .max(1000, { error: "Use 1000 characters or fewer." }),
  /** ISO date-time, or empty for an indefinite suspension. */
  until: z.string().optional(),
});
export type DecisionInput = z.input<typeof decisionSchema>;

export const suspendSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: "Say why. The member sees this reason." })
    .max(500, { error: "Use 500 characters or fewer." }),
  until: z.string().optional(),
});

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and dashes." })
  .max(60);

export const spaceSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the space." }).max(60),
  slug,
  description: z.string().trim().max(500, { error: "Use 500 characters or fewer." }),
  type: z.enum(["department", "batch", "module", "club", "general"]),
  departmentId: z.string(),
  yearOfStudy: z.string(),
  moduleCode: z.string().trim().max(20),
  icon: z.string().trim().max(40),
  joinPolicy: z.enum(["open", "approval"]),
  rules: z.string().trim().max(4000, { error: "Use 4000 characters or fewer." }),
});
export type SpaceInput = z.input<typeof spaceSchema>;

export const spaceDetailsSchema = spaceSchema.pick({
  description: true,
  rules: true,
  joinPolicy: true,
});
export type SpaceDetailsInput = z.input<typeof spaceDetailsSchema>;

export const departmentSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the department." }).max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, { error: "Use 2–6 capital letters, e.g. COM." }),
});
export type DepartmentInput = z.input<typeof departmentSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(2, { error: "Use at least 2 characters." }).max(30),
  description: z.string().trim().max(200, { error: "Use 200 characters or fewer." }),
});
export type TagInput = z.input<typeof tagSchema>;

/** "Databases & SQL" → "databases-sql" */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
