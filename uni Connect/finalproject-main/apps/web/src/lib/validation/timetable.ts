import * as z from "zod";

/** Timetable and attendance forms. */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Choose a time." });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a date." });

export const timetableEntrySchema = z
  .object({
    entryId: z.union([z.literal(""), z.uuid()]),
    batchId: z.uuid({ error: "Choose a batch." }),
    moduleName: z
      .string()
      .trim()
      .min(2, { error: "Enter the module name." })
      .max(120, { error: "Use 120 characters or fewer." }),
    moduleCode: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9 -]{2,20}$/, { error: "Use 2–20 letters or numbers, e.g. CS201." }),
    ]),
    lecturerId: z.union([z.literal(""), z.uuid()]),
    weekday: z.number().int().min(1, { error: "Choose a day." }).max(7),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(80, { error: "Use 80 characters or fewer." }),
    startsOn: day,
    endsOn: day,
  })
  .refine((v) => v.endTime > v.startTime, {
    path: ["endTime"],
    error: "The class must end after it starts.",
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    path: ["endsOn"],
    error: "The term must end after it starts.",
  });

export type TimetableEntryInput = z.input<typeof timetableEntrySchema>;

export const reasonSchema = z
  .string()
  .trim()
  .min(3, { error: "Give a short reason." })
  .max(300, { error: "Use 300 characters or fewer." });
