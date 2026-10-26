import type { Enums } from "@/types/database";

export type UserRole = Enums<"user_role">;
export type AccountStatus = Enums<"account_status">;
export type VisibilityLevel = Enums<"visibility_level">;
export type RequestPermission = Enums<"request_permission">;

/**
 * Years of study on campus. Stored as `profiles.year_of_study` (0-5).
 * Change the labels here; the numbers are what the database keeps.
 */
export const YEAR_OPTIONS = [
  { value: 0, label: "Foundation" },
  { value: 1, label: "Year 1" },
  { value: 2, label: "Year 2" },
  { value: 3, label: "Year 3" },
  { value: 4, label: "Final year / Top-up" },
  { value: 5, label: "Postgraduate" },
] as const;

export function yearLabel(year: number | null | undefined): string | null {
  if (year === null || year === undefined) return null;
  return YEAR_OPTIONS.find((option) => option.value === year)?.label ?? null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  lecturer: "Lecturer",
  coordinator: "Coordinator",
  super_admin: "Super admin",
};

/**
 * Account roles in order: each one has the powers of the ones before it, as in
 * SQL `has_role`. Class rep and club captain are positions a student holds, not roles.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  student: 0,
  lecturer: 1,
  coordinator: 2,
  super_admin: 3,
};

export const USER_ROLES = Object.keys(ROLE_RANK) as UserRole[];

/** True when `role` is `min` or above. */
export function roleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const VISIBILITY_OPTIONS: { value: VisibilityLevel; label: string; description: string }[] =
  [
    {
      value: "everyone",
      label: "Everyone on UniConnect",
      description: "Approved members can see your full profile.",
    },
    {
      value: "department",
      label: "My department only",
      description: "Others see just your name, photo and department.",
    },
    {
      value: "only_me",
      label: "Only me",
      description: "Others see just your name and photo.",
    },
  ];

export const MENTORSHIP_REQUEST_OPTIONS: { value: RequestPermission; label: string }[] = [
  { value: "everyone", label: "Anyone on UniConnect" },
  { value: "department", label: "People in my department" },
  { value: "nobody", label: "Nobody" },
];

/** Suggestions for the interests / expertise pickers (people can add their own). */
export const INTEREST_SUGGESTIONS = [
  "Programming",
  "Web development",
  "Data science",
  "AI & machine learning",
  "Cyber security",
  "Networking",
  "UI/UX design",
  "Entrepreneurship",
  "Marketing",
  "Finance",
  "Accounting",
  "Management",
  "Engineering design",
  "Robotics",
  "Law & policy",
  "Debate",
  "Writing",
  "Languages",
  "Photography",
  "Music",
  "Sports",
  "Volunteering",
  "Internships",
  "Research",
] as const;

export function isStaffRole(role: UserRole): boolean {
  return roleAtLeast(role, "lecturer");
}
