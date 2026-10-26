import * as z from "zod";

import { fullNameSchema } from "@/lib/validation/auth";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, {
    error: "Use 3–30 lowercase letters, numbers or underscores.",
  });

const tag = z.string().trim().min(2).max(40);
const tagList = z.array(tag).max(15, { error: "Choose up to 15." });

export const bioSchema = z.string().trim().max(160, { error: "Use 160 characters or fewer." });

export const onboardingSchema = z.object({
  username: usernameSchema,
  bio: bioSchema.optional(),
  interests: tagList.min(3, { error: "Pick at least 3 interests." }),
  expertise: tagList,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    bio: bioSchema.optional(),
    departmentId: z.uuid({ error: "Choose your department." }),
    yearOfStudy: z.string().optional(),
    interests: tagList,
    expertise: tagList,
  })
  .transform((data) => ({
    ...data,
    yearOfStudy: /^[0-5]$/.test(data.yearOfStudy ?? "") ? Number(data.yearOfStudy) : null,
  }));
export type ProfileInput = z.input<typeof profileSchema>;

export const privacySchema = z.object({
  profileVisibility: z.enum(["everyone", "department", "only_me"]),
  showYear: z.boolean(),
  mentorshipRequestsFrom: z.enum(["everyone", "department", "nobody"]),
});
export type PrivacyInput = z.infer<typeof privacySchema>;

export const deletionRequestSchema = z.object({
  reason: z.string().trim().max(500, { error: "Use 500 characters or fewer." }).optional(),
});
