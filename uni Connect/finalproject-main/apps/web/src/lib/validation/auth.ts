import * as z from "zod";

import { parseStudentId, STUDENT_ID_EXAMPLE } from "@/lib/student-id";

/** Shared by the forms (instant feedback) and the Server Actions (the real check). */

// Trim and lower-case first, so a pasted trailing space doesn't fail the format check.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: "Enter a valid email address." })
      .max(254, { error: "That email is too long." }),
  );

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use 72 characters or fewer." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Enter your full name." })
  .max(80, { error: "Use 80 characters or fewer." });

/** Students sign up with an ID like AB/CSE/UNI/17/04; its intake number suggests their batch. */
function checkStudentId(
  data: { requestedRole: "student" | "staff"; idNumber: string },
  ctx: z.RefinementCtx,
) {
  if (data.requestedRole === "student" && !parseStudentId(data.idNumber)) {
    ctx.addIssue({
      code: "custom",
      path: ["idNumber"],
      message: `Use your student ID in the campus format, e.g. ${STUDENT_ID_EXAMPLE}.`,
    });
  }
}

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
    requestedRole: z.enum(["student", "staff"], { error: "Choose student or staff." }),
    departmentId: z.uuid({ error: "Choose your department." }),
    idNumber: z
      .string()
      .trim()
      .min(2, { error: "Enter your student or staff ID." })
      .max(40, { error: "Use 40 characters or fewer." }),
    note: z.string().trim().max(300, { error: "Use 300 characters or fewer." }).optional(),
    consent: z.literal("on", { error: "Please agree to the community rules and privacy notice." }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords don't match.",
      });
    }
    checkStudentId(data, ctx);
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

/** Pending users may correct their application while they wait. */
export const pendingApplicationSchema = z
  .object({
    fullName: fullNameSchema,
    requestedRole: z.enum(["student", "staff"]),
    departmentId: z.uuid({ error: "Choose your department." }),
    idNumber: z
      .string()
      .trim()
      .min(2, { error: "Enter your student or staff ID." })
      .max(40, { error: "Use 40 characters or fewer." }),
    note: z.string().trim().max(300, { error: "Use 300 characters or fewer." }).optional(),
  })
  .superRefine((data, ctx) => {
    checkStudentId(data, ctx);
  });

/** Only allow redirects to paths inside this app (no open redirects). */
export function safeNextPath(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
