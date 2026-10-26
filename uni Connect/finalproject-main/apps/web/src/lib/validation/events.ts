import * as z from "zod";

export const MIN_EVENT_DESCRIPTION = 20;

const isoDate = z.iso.datetime({ error: "Choose a date and time." });

export const eventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, { error: "Use at least 5 characters." })
      .max(150, { error: "Keep the title under 150 characters." }),
    descriptionHtml: z.string().max(40000, { error: "That's too long. Try shortening it." }),
    category: z.enum(
      ["academic", "career", "workshop", "social", "cultural", "sports", "club", "other"],
      {
        error: "Choose a category.",
      },
    ),
    organizingUnit: z
      .string()
      .trim()
      .min(2, { error: "Say who is running it, e.g. Careers Office." })
      .max(60, { error: "Use 60 characters or fewer." }),
    format: z.enum(["in_person", "online", "hybrid"]),
    venue: z.string().trim().max(120, { error: "Use 120 characters or fewer." }),
    locationDetails: z.string().trim().max(200, { error: "Use 200 characters or fewer." }),
    onlineUrl: z.union([
      z.literal(""),
      z
        .url({ protocol: /^https$/, error: "Use a full https:// link." })
        .max(500, { error: "That link is too long." }),
    ]),
    startsAt: isoDate,
    endsAt: isoDate,
    registrationDeadline: z.union([z.literal(""), isoDate]),
    capacity: z
      .number({ error: "Enter a whole number." })
      .int({ error: "Enter a whole number." })
      .min(1, { error: "At least 1 seat." })
      .max(10000, { error: "At most 10,000 seats." })
      .nullable(),
    waitlistEnabled: z.boolean(),
    departmentIds: z.array(z.uuid()).max(20),
    years: z.array(z.number().int().min(0).max(5)).max(6),
    eligibilityNote: z.string().trim().max(200, { error: "Use 200 characters or fewer." }),
    coverUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(500)]),
    spaceId: z.union([z.literal(""), z.uuid()]),
    status: z.enum(["draft", "published"]),
  })
  .superRefine((v, ctx) => {
    if (v.format !== "online" && !v.venue) {
      ctx.addIssue({ code: "custom", path: ["venue"], message: "Where is it happening?" });
    }
    if (v.format !== "in_person" && !v.onlineUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["onlineUrl"],
        message: "Add the link people join with.",
      });
    }
    const start = new Date(v.startsAt).getTime();
    const end = new Date(v.endsAt).getTime();
    if (end <= start) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "It has to end after it starts." });
    }
    if (v.registrationDeadline && new Date(v.registrationDeadline).getTime() > start) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationDeadline"],
        message: "Registration has to close before the event starts.",
      });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;

export const cancelEventSchema = z
  .string()
  .trim()
  .min(5, { error: "Give a short reason (at least 5 characters)." })
  .max(500, { error: "Use 500 characters or fewer." });

/** The /events date filter. */
export const EVENT_WHEN = ["upcoming", "week", "month", "past"] as const;
export type EventWhen = (typeof EVENT_WHEN)[number];

export function parseEventWhen(value: unknown): EventWhen {
  return EVENT_WHEN.includes(value as EventWhen) ? (value as EventWhen) : "upcoming";
}
