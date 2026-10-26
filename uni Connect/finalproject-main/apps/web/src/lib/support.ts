/**
 * Support inbox and complaint box: ticket kinds, categories, statuses
 * and form validation. Pure, shared by the server and the browser. The category values match the
 * check constraint in migration 0042.
 */

import * as z from "zod";

import type { CategoryTint } from "@/components/shared/badges";

export type TicketKind = "support" | "complaint";
export type TicketStatus = "open" | "in_progress" | "resolved";

export interface TicketCategory {
  value: string;
  label: string;
  /** Option group in the complaint form. */
  group?: string;
  /** Campus management (super admins) is always told about these. */
  urgent?: boolean;
}

export const SUPPORT_CATEGORIES: TicketCategory[] = [
  { value: "account", label: "Account and login" },
  { value: "app", label: "Problem with UniConnect" },
  { value: "academic", label: "Academic question" },
  { value: "other", label: "Something else" },
];

export const COMPLAINT_CATEGORIES: TicketCategory[] = [
  { value: "facilities_ac", label: "Air conditioning", group: "Facilities" },
  { value: "facilities_projector", label: "Projector or screen", group: "Facilities" },
  { value: "facilities_wifi", label: "Wi-Fi", group: "Facilities" },
  { value: "facilities_washrooms", label: "Washrooms", group: "Facilities" },
  { value: "facilities_furniture", label: "Furniture", group: "Facilities" },
  { value: "facilities_cleanliness", label: "Cleanliness", group: "Facilities" },
  { value: "teaching_absent", label: "Lecturer late or absent", group: "Teaching" },
  { value: "teaching_quality", label: "Lecture quality", group: "Teaching" },
  { value: "timetable_admin", label: "Timetable and admin", group: "Admin" },
  { value: "safety", label: "Safety and security", group: "Safety", urgent: true },
  { value: "harassment", label: "Harassment or bullying", group: "Safety", urgent: true },
  { value: "other", label: "Something else", group: "Other" },
];

export function categoriesFor(kind: TicketKind): TicketCategory[] {
  return kind === "support" ? SUPPORT_CATEGORIES : COMPLAINT_CATEGORIES;
}

export function categoryLabel(kind: TicketKind, value: string): string {
  return categoriesFor(kind).find((c) => c.value === value)?.label ?? value;
}

export const TICKET_STATUS: Record<TicketStatus, { label: string; tint: CategoryTint }> = {
  open: { label: "Open", tint: "amber" },
  in_progress: { label: "In progress", tint: "blue" },
  resolved: { label: "Resolved", tint: "emerald" },
};

export const KIND_LABELS: Record<TicketKind, string> = {
  support: "Support",
  complaint: "Complaint",
};

export function parseKind(value: unknown): TicketKind {
  return value === "complaint" ? "complaint" : "support";
}

export function parseStatus(value: unknown): TicketStatus | undefined {
  return value === "open" || value === "in_progress" || value === "resolved" ? value : undefined;
}

/** Photos for complaints: PNG or JPEG up to 5 MB (the bucket enforces the same). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = { "image/png": "png", "image/jpeg": "jpg" } as const;

export const ticketSchema = z
  .object({
    kind: z.enum(["support", "complaint"]),
    category: z.string().min(1, { error: "Choose a category." }),
    subject: z
      .string()
      .trim()
      .min(3, { error: "Add a short subject." })
      .max(150, { error: "Use 150 characters or fewer." }),
    body: z
      .string()
      .trim()
      .min(10, { error: "Tell us a bit more (at least 10 characters)." })
      .max(4000, { error: "Use 4,000 characters or fewer." }),
    anonymous: z.boolean(),
    toManagement: z.boolean(),
    /** A path returned by the photo upload, or "". */
    photoPath: z.union([z.literal(""), z.string().regex(/^incoming\/[0-9a-f-]{36}\.(png|jpg)$/)]),
  })
  .refine((t) => categoriesFor(t.kind).some((c) => c.value === t.category), {
    path: ["category"],
    error: "Choose a category.",
  })
  .refine((t) => t.kind === "complaint" || (!t.anonymous && !t.photoPath), {
    path: ["anonymous"],
    error: "Only complaints can be anonymous or have a photo.",
  });

export type TicketInput = z.input<typeof ticketSchema>;
