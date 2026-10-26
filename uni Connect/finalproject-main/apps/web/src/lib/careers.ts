/**
 * Careers: opportunity types, work modes, the posting form's validation
 * and whether an opportunity is still open. Pure, shared by the server and the browser.
 */

import * as z from "zod";

import type { CategoryTint } from "@/components/shared/badges";

export type OpportunityType = "internship" | "part_time" | "graduate";
export type WorkMode = "on_site" | "remote" | "hybrid";

export const OPPORTUNITY_TYPES: { value: OpportunityType; label: string; tint: CategoryTint }[] = [
  { value: "internship", label: "Internship", tint: "blue" },
  { value: "part_time", label: "Part-time", tint: "teal" },
  { value: "graduate", label: "Graduate role", tint: "violet" },
];

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "on_site", label: "On-site" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

export function typeInfo(type: OpportunityType) {
  return OPPORTUNITY_TYPES.find((t) => t.value === type) ?? OPPORTUNITY_TYPES[0];
}

export function modeLabel(mode: WorkMode): string {
  return WORK_MODES.find((m) => m.value === mode)?.label ?? mode;
}

/** Open until someone closes it or its deadline passes. */
export function isOpen(
  o: { status: "open" | "closed"; deadline: string | null },
  now: Date = new Date(),
): boolean {
  return o.status === "open" && (!o.deadline || new Date(o.deadline).getTime() > now.getTime());
}

/** Deadline filter values (`?closes=`). */
export const DEADLINE_FILTERS = [
  { value: "week", label: "Closing within a week", days: 7 },
  { value: "month", label: "Closing within a month", days: 31 },
] as const;
export type DeadlineFilter = (typeof DEADLINE_FILTERS)[number]["value"];

export function parseDeadlineFilter(value: unknown): DeadlineFilter | undefined {
  return DEADLINE_FILTERS.find((d) => d.value === value)?.value;
}

export const opportunitySchema = z
  .object({
    id: z.union([z.literal(""), z.uuid()]),
    title: z
      .string()
      .trim()
      .min(3, { error: "Give it a title, e.g. Software engineering intern." })
      .max(150, { error: "Use 150 characters or fewer." }),
    company: z
      .string()
      .trim()
      .min(2, { error: "Who is hiring?" })
      .max(120, { error: "Use 120 characters or fewer." }),
    type: z.enum(["internship", "part_time", "graduate"]),
    mode: z.enum(["on_site", "remote", "hybrid"]),
    location: z.string().trim().max(120, { error: "Use 120 characters or fewer." }),
    description: z
      .string()
      .trim()
      .min(20, { error: "Describe the role in a few sentences (at least 20 characters)." })
      .max(5000, { error: "Use 5,000 characters or fewer." }),
    applyUrl: z.union([
      z.literal(""),
      z.url({ protocol: /^https$/, error: "Use a full https:// link." }).max(500),
    ]),
    applyEmail: z.union([
      z.literal(""),
      z.email({ error: "Enter a valid email address." }).max(200),
    ]),
    /** ISO instant or "". */
    deadline: z.union([z.literal(""), z.iso.datetime()]),
    /** "" = campus-wide (super admins only). */
    departmentId: z.union([z.literal(""), z.uuid()]),
    batchIds: z.array(z.uuid()),
  })
  .refine((o) => o.applyUrl || o.applyEmail, {
    path: ["applyUrl"],
    error: "Add a link or an email address to apply.",
  })
  .refine((o) => o.departmentId || o.batchIds.length === 0, {
    path: ["batchIds"],
    error: "Pick a department to choose batches.",
  });

export type OpportunityInput = z.input<typeof opportunitySchema>;
