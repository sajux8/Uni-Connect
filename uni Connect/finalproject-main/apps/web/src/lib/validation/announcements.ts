import * as z from "zod";

export const MIN_ANNOUNCEMENT_BODY = 20;

const optionalDate = z.union([z.literal(""), z.iso.datetime({ error: "Choose a valid date." })]);

export const announcementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, { error: "Use at least 5 characters." })
      .max(150, { error: "Keep the title under 150 characters." }),
    bodyHtml: z.string().max(40000, { error: "That's too long. Try splitting it up." }),
    category: z.enum(["academic", "deadline", "general", "event", "urgent"], {
      error: "Choose a category.",
    }),
    publishingUnit: z
      .string()
      .trim()
      .min(2, { error: "Say who it's from, e.g. Registry." })
      .max(60, { error: "Use 60 characters or fewer." }),
    audienceAll: z.boolean(),
    departmentIds: z.array(z.uuid()).max(20),
    years: z.array(z.number().int().min(0).max(5)).max(6),
    pinned: z.boolean(),
    pinnedUntil: optionalDate,
    important: z.boolean(),
    /** publish = live now (or stay live when editing), schedule = go live at publishAt, draft = save only. */
    mode: z.enum(["publish", "schedule", "draft"]),
    publishAt: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (!value.audienceAll && value.departmentIds.length === 0 && value.years.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["audience"],
        message: "Choose at least one department or year, or send it to everyone.",
      });
    }
    if (value.mode === "schedule") {
      if (!value.publishAt) {
        ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Choose when to publish." });
      } else if (new Date(value.publishAt).getTime() < Date.now() + 60_000) {
        ctx.addIssue({
          code: "custom",
          path: ["publishAt"],
          message: "Choose a time in the future.",
        });
      }
    }
    if (value.pinned && value.pinnedUntil && new Date(value.pinnedUntil).getTime() < Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["pinnedUntil"],
        message: "Choose a date in the future, or leave it empty.",
      });
    }
  });

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const ANNOUNCEMENT_SCOPES = ["all", "for_me", "unread"] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export function parseAnnouncementScope(value: unknown): AnnouncementScope {
  return ANNOUNCEMENT_SCOPES.includes(value as AnnouncementScope)
    ? (value as AnnouncementScope)
    : "all";
}
