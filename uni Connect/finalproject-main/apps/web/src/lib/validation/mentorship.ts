import * as z from "zod";

import {
  MAX_MENTEES_LIMIT,
  MESSAGE_MAX,
  REQUEST_MESSAGE_MAX,
  REQUEST_MESSAGE_MIN,
} from "@/lib/mentorship";

const tag = z.string().trim().min(2).max(40);

export const mentorProfileSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(3, { error: "Add a short headline." })
    .max(100, { error: "Use 100 characters or fewer." }),
  about: z.string().trim().max(1000, { error: "Use 1000 characters or fewer." }),
  subjects: z
    .array(tag)
    .min(1, { error: "Pick at least one subject." })
    .max(8, { error: "Choose up to 8." }),
  skills: z.array(tag).max(8, { error: "Choose up to 8." }),
  availabilityNote: z.string().trim().max(200, { error: "Use 200 characters or fewer." }),
  maxActiveMentees: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_MENTEES_LIMIT, { error: `Up to ${MAX_MENTEES_LIMIT} mentees.` }),
  isAccepting: z.boolean(),
});
export type MentorProfileInput = z.input<typeof mentorProfileSchema>;

export const mentorshipRequestSchema = z.object({
  mentorId: z.uuid(),
  topic: z
    .string()
    .trim()
    .min(3, { error: "Say what you'd like help with." })
    .max(100, { error: "Use 100 characters or fewer." }),
  message: z
    .string()
    .trim()
    .min(REQUEST_MESSAGE_MIN, {
      error: `Tell them a bit more (at least ${REQUEST_MESSAGE_MIN} characters).`,
    })
    .max(REQUEST_MESSAGE_MAX, { error: `Use ${REQUEST_MESSAGE_MAX} characters or fewer.` }),
});
export type MentorshipRequestInput = z.input<typeof mentorshipRequestSchema>;

export const responseNoteSchema = z
  .string()
  .trim()
  .max(300, { error: "Use 300 characters or fewer." });

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, { error: "Write a message first." })
  .max(MESSAGE_MAX, { error: `Messages can be up to ${MESSAGE_MAX} characters.` });
